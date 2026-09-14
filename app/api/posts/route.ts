import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { CUR, CurrencyCode, toBase } from "@/lib/currency";
import { computePinFloor } from "@/lib/pinPricing";
import { friendlyError } from "@/lib/apiError";
import { scan, moderateServerSide } from "@/lib/moderation";
import { hashOwnerKey, mkOwnerCode } from "@/lib/ownerKey";
import { createOrder } from "@/lib/razorpay";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { verifyTurnstile } from "@/lib/turnstile";
import type { Post } from "@/lib/types";

export const runtime = "nodejs";

function rowToPost(r: Record<string, unknown>): Post {
  return {
    id: r.id as string,
    type: r.type as Post["type"],
    category: r.category as Post["category"],
    text: r.text as string,
    oa: (r.option_a as string) ?? null,
    ob: (r.option_b as string) ?? null,
    bg: (r.bg as string) ?? "plain",
    tier: r.tier as Post["tier"],
    currency: r.currency as CurrencyCode,
    paid: (r.paid_base as number) ?? null,
    until: r.until ? new Date(r.until as string).getTime() : null,
    va: (r.va as number) ?? 0,
    vb: (r.vb as number) ?? 0,
    reactions: (r.reactions as Record<string, number>) ?? {},
    reports: (r.reports as number) ?? 0,
    hidden: !!r.hidden,
    outcome: (r.outcome as Post["outcome"]) ?? null,
    at: new Date(r.created_at as string).getTime(),
  };
}

// GET /api/posts — the live board. Mirrors the original's "load everything,
// filter/sort on the client" approach; fine at this scale, revisit with
// server-side pagination once volume is real.
export async function GET() {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("posts")
    .select("*")
    .eq("status", "live")
    .eq("hidden", false)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) return NextResponse.json({ error: friendlyError("posts.get", error) }, { status: 500 });
  return NextResponse.json({ posts: (data ?? []).map(rowToPost) });
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
  })
  .refine((d) => d.type !== "dilemma" || (d.optionA && d.optionB), {
    message: "Dilemmas need both options.",
  });

// POST /api/posts — validate + moderate, price it, open a Razorpay order, and
// insert the post as `pending_payment`. It only ever becomes `live` from the
// webhook once Razorpay confirms the payment — see app/api/razorpay/webhook.
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
  const amountMinor = Math.round(amountMajor * 100); // Razorpay wants the smallest sub-unit; all our currencies use 100.
  const paidBase = toBase(amountMajor, b.currency);

  const ownerCode = b.ownerKey || mkOwnerCode();
  const ownerKeyHash = hashOwnerKey(ownerCode);

  // A retried submit (same modal, same idempotency key) reuses whatever
  // draft the first attempt already created instead of making a second post
  // — see PostModal.tsx. A key that already belongs to a *live* post means
  // the first attempt actually succeeded; don't post it again.
  let postId: string;
  let reusingDraft = false;
  if (b.idempotencyKey) {
    const { data: existing } = await sb
      .from("posts")
      .select("id, status")
      .eq("idempotency_key", b.idempotencyKey)
      .maybeSingle();
    if (existing?.status === "live") {
      return NextResponse.json(
        { error: "This already went live — check My posts instead of posting it again.", alreadyLive: true, postId: existing.id },
        { status: 409 }
      );
    }
    if (existing?.status === "pending_payment") {
      postId = existing.id;
      reusingDraft = true;
    } else {
      postId = "p" + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    }
  } else {
    postId = "p" + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  }

  if (!reusingDraft) {
    const { error: insertErr } = await sb.from("posts").insert({
      id: postId,
      type: b.type,
      category: b.category,
      text: b.text,
      option_a: b.optionA ?? null,
      option_b: b.optionB ?? null,
      bg: b.bg,
      tier: b.tier,
      status: "pending_payment",
      owner_key_hash: ownerKeyHash,
      currency: b.currency,
      paid_amount_minor: amountMinor,
      paid_base: paidBase,
      idempotency_key: b.idempotencyKey ?? null,
    });
    if (insertErr) return NextResponse.json({ error: friendlyError("posts.insert", insertErr) }, { status: 500 });
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
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (e) {
    // Razorpay not configured yet, or the API call failed — clean up a
    // freshly-created pending post rather than leaving an orphan nobody can
    // ever pay for (but keep a reused draft around; it's not orphaned, it's
    // just waiting on a working payment provider).
    if (!reusingDraft) await sb.from("posts").delete().eq("id", postId);
    return NextResponse.json(
      { error: friendlyError("posts.createOrder", e, "Payments are temporarily unavailable — try again in a few minutes.") },
      { status: 502 }
    );
  }
}
