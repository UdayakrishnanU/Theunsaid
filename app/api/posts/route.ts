import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { CUR, CurrencyCode, toBase } from "@/lib/currency";
import { computePinFloor } from "@/lib/pinPricing";
import { friendlyError } from "@/lib/apiError";
import { scan, moderateServerSide } from "@/lib/moderation";
import { hashOwnerKey, mkOwnerCode } from "@/lib/ownerKey";
import { createOrder, cashfreeMode } from "@/lib/cashfree";
import { isAdmin } from "@/lib/adminAuth";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { verifyTurnstile } from "@/lib/turnstile";
import { getOrCreateVoterId } from "@/lib/identity";
import { linkVoterOwnerKey, recordDevicePing } from "@/lib/deviceTracker";
import type { Post } from "@/lib/types";

export const runtime = "nodejs";

import { getLivePosts, rowToPost } from "@/lib/posts";

// GET /api/posts — the live board.
export async function GET() {
  const posts = await getLivePosts();
  return NextResponse.json(
    { posts },
    {
      headers: {
        "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30",
      },
    }
  );
}

const CATEGORIES = ["relationships", "work", "money", "family", "random"] as const;
const CURRENCIES = Object.keys(CUR) as CurrencyCode[];

const bodySchema = z
  .object({
    type: z.enum(["confession", "dilemma"]),
    category: z.enum(CATEGORIES),
    // .trim() first so whitespace-only text/options can't slip past a fast or
    // modified client that skips the same check the form already does.
    text: z.string().trim().min(1).max(800),
    optionA: z.string().trim().min(1).max(22).optional(),
    optionB: z.string().trim().min(1).max(22).optional(),
    bg: z.string().max(20).default("plain"),
    tier: z.enum(["std", "glow", "pin"]).default("std"),
    currency: z.enum(CURRENCIES as [CurrencyCode, ...CurrencyCode[]]),
    bidAmount: z.number().positive().optional(), // in major currency units, tier==='pin' only
    ownerKey: z.string().min(4).max(16).optional(), // existing device key, if the poster already has one
    turnstileToken: z.string().optional(),
    idempotencyKey: z.string().min(8).max(64).optional(), // one per modal-open, see PostModal.tsx
    // Admin-only, never shown to real visitors: skip Cashfree entirely and
    // publish immediately, so the owner-key/posting/restore flow can be
    // exercised for free. Re-checked against an actual admin session below —
    // a client sending this without a valid admin cookie is silently ignored.
    devSkipPayment: z.boolean().optional(),
  })
  .refine((d) => d.type !== "dilemma" || (d.optionA && d.optionB), {
    message: "Dilemmas need both options.",
  });

// POST /api/posts — validate + moderate, price it, open a Cashfree order, and
// save a pending post. The post is NOT visible on the board until the Cashfree
// webhook or instant client confirm route confirms the payment — see app/api/cashfree/webhook.
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const rl = await rateLimit(`post:${ip}`, 6, 600); // 6 posts / 10 min / IP
  if (!rl.success) {
    return NextResponse.json({ error: "Too many posts from this connection. Try again shortly." }, { status: 429 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid submission." }, { status: 400 });
  }
  const b = parsed.data;

  const humanCheck = await verifyTurnstile(b.turnstileToken, ip);
  if (!humanCheck) {
    return NextResponse.json(
      { error: "That didn't pass our bot check. If an ad-blocker or privacy extension is active, try disabling it for this site — no need to reload." },
      { status: 400 }
    );
  }

  const combined = [b.text, b.optionA, b.optionB].filter(Boolean).join(" ");
  const scanResult = scan(combined);
  if (scanResult === "care") {
    return NextResponse.json({ careFlag: true }, { status: 200 });
  }
  if (scanResult) {
    return NextResponse.json({ error: scanResult }, { status: 400 });
  }
  const moderation = await moderateServerSide(combined);
  if (moderation.flagged) {
    return NextResponse.json({ error: "That doesn't pass moderation — rewrite it and try again." }, { status: 400 });
  }

  const sb = supabaseAdmin();

  // Price it.
  let amountMajor: number;
  if (b.tier === "pin") {
    // Same computation the create-post form used to show its floor price —
    // see lib/pinPricing.ts — so a bid that was accepted as "enough" there
    // can never be rejected here for a different number.
    const { floorBase } = await computePinFloor(sb, b.currency);
    const bidBase = b.bidAmount ? toBase(b.bidAmount, b.currency) : 0;
    if (!b.bidAmount || bidBase < floorBase) {
      return NextResponse.json(
        { error: `The shelf is held higher than that bid. You need at least the current floor to get on it.`, floorBase },
        { status: 400 }
      );
    }
    amountMajor = b.bidAmount;
  } else {
    amountMajor = b.tier === "glow" ? CUR[b.currency].glow : CUR[b.currency].post;
  }
  const amountMinor = Math.round(amountMajor * 100); // Smallest sub-unit (paise for INR, cents for USD).
  const paidBase = toBase(amountMajor, b.currency);

  const ownerCode = b.ownerKey || mkOwnerCode();
  const ownerKeyHash = hashOwnerKey(ownerCode);

  try {
    const voterId = await getOrCreateVoterId();
    linkVoterOwnerKey(voterId, ownerKeyHash);
    recordDevicePing(voterId, {
      userAgent: req.headers.get("user-agent"),
      platform: req.headers.get("sec-ch-ua-platform"),
      mobile: req.headers.get("sec-ch-ua-mobile"),
    }, ownerKeyHash);
  } catch {
    // Non-critical tracking
  }

  const postId = "p" + crypto.randomUUID().replace(/-/g, "").slice(0, 16);

  // Dev bypass: only ever takes effect for a real, currently-signed-in admin
  // session — a forged flag from a normal visitor's client does nothing,
  // since isAdmin() re-checks the httpOnly session cookie server-side.
  const devBypass = b.devSkipPayment === true && (await isAdmin());

  const { error: insertErr } = await sb.from("posts").insert({
    id: postId,
    type: b.type,
    category: b.category,
    text: b.text,
    option_a: b.optionA ?? null,
    option_b: b.optionB ?? null,
    bg: b.bg,
    tier: b.tier,
    status: devBypass ? "live" : "pending_payment",
    owner_key_hash: ownerKeyHash,
    currency: b.currency,
    paid_amount_minor: amountMinor,
    paid_base: paidBase,
  });
  if (insertErr) return NextResponse.json({ error: friendlyError("posts.insert", insertErr) }, { status: 500 });

  if (devBypass) {
    return NextResponse.json({ postId, ownerKey: ownerCode, dev: true });
  }

  try {
    const order = await createOrder(amountMinor, b.currency, postId, { postId, tier: b.tier });
    const { error: orderErr } = await sb.from("payment_orders").insert({
      id: order.id,
      post_id: postId,
      amount_minor: amountMinor,
      currency: b.currency,
      status: "created",
    });
    if (orderErr) return NextResponse.json({ error: friendlyError("posts.order-insert", orderErr) }, { status: 500 });

    return NextResponse.json({
      postId,
      ownerKey: ownerCode,
      order: { id: order.id, amount: amountMinor, currency: b.currency },
      cashfree: { paymentSessionId: order.paymentSessionId, mode: cashfreeMode() },
    });
  } catch (e) {
    console.error("[api:posts.createOrder]", e);
    await sb.from("posts").delete().eq("id", postId);
    return NextResponse.json(
      { error: friendlyError("posts.createOrder", e, "Payments are temporarily unavailable — try again in a few minutes.") },
      { status: 502 }
    );
  }
}
