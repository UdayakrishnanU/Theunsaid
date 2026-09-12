import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { CUR, CurrencyCode, toBase, minBidBase, BID_STEP } from "@/lib/currency";
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
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ posts: (data ?? []).map(rowToPost) });
}

const CATEGORIES = ["relationships", "work", "money", "family", "random"] as const;
const CURRENCIES = Object.keys(CUR) as CurrencyCode[];

const bodySchema = z
  .object({
    type: z.enum(["confession", "dilemma"]),
    category: z.enum(CATEGORIES),
    text: z.string().min(1).max(800),
    optionA: z.string().max(22).optional(),
    optionB: z.string().max(22).optional(),
    bg: z.string().max(20).default("plain"),
    tier: z.enum(["std", "glow", "pin"]).default("std"),
    currency: z.enum(CURRENCIES as [CurrencyCode, ...CurrencyCode[]]),
    bidAmount: z.number().positive().optional(), // in major currency units, tier==='pin' only
    ownerKey: z.string().min(4).max(16).optional(), // existing device key, if the poster already has one
    turnstileToken: z.string().optional(),
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
    return NextResponse.json({ error: "That didn't pass the bot check — reload and try again." }, { status: 400 });
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
    const { data: shelfRows } = await sb
      .from("posts")
      .select("paid_base")
      .eq("status", "live")
      .eq("tier", "pin")
      .gt("until", new Date().toISOString())
      .order("paid_base", { ascending: false })
      .limit(5);
    const shelf = shelfRows ?? [];
    const floorBase =
      shelf.length < 5
        ? minBidBase(b.currency)
        : Math.max((shelf[shelf.length - 1].paid_base as number) + BID_STEP, minBidBase(b.currency));
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
  const postId = "p" + crypto.randomUUID().replace(/-/g, "").slice(0, 16);

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
  });
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  try {
    const order = await createOrder(amountMinor, b.currency, postId, { postId, tier: b.tier });
    const { error: orderErr } = await sb.from("payment_orders").insert({
      id: order.id,
      post_id: postId,
      amount_minor: amountMinor,
      currency: b.currency,
      status: "created",
    });
    if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 500 });

    return NextResponse.json({
      postId,
      ownerKey: ownerCode,
      order: { id: order.id, amount: amountMinor, currency: b.currency },
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (e) {
    // Razorpay not configured yet, or the API call failed — clean up the
    // pending post rather than leaving an orphan nobody can ever pay for.
    await sb.from("posts").delete().eq("id", postId);
    const message = e instanceof Error ? e.message : "Could not start payment.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
