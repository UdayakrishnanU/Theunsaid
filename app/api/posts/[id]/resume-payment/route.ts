import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { hashOwnerKey } from "@/lib/ownerKey";
import { createOrder } from "@/lib/razorpay";
import { friendlyError } from "@/lib/apiError";

export const runtime = "nodejs";

const schema = z.object({ ownerKey: z.string().min(4).max(16) });

// POST /api/posts/[id]/resume-payment — for a post stuck as pending_payment
// (checkout tab closed, bank was slow, or the draft was just abandoned): opens
// a brand-new Razorpay order for the exact same post/amount instead of
// leaving it as a dead end with no way back in except deleting it.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Owner key required." }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: post, error } = await sb.from("posts").select("*").eq("id", id).single();
  if (error || !post) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (post.owner_key_hash !== hashOwnerKey(parsed.data.ownerKey)) {
    return NextResponse.json({ error: "That key doesn't own this post." }, { status: 403 });
  }
  if (post.status !== "pending_payment") {
    return NextResponse.json({ error: "This post isn't waiting on payment." }, { status: 400 });
  }

  try {
    const order = await createOrder(post.paid_amount_minor, post.currency, id, { postId: id, tier: post.tier, resumed: "true" });
    const { error: orderErr } = await sb.from("payment_orders").insert({
      id: order.id,
      post_id: id,
      amount_minor: post.paid_amount_minor,
      currency: post.currency,
      status: "created",
    });
    if (orderErr) return NextResponse.json({ error: friendlyError("resume-payment.insert", orderErr) }, { status: 500 });

    return NextResponse.json({
      order: { id: order.id, amount: post.paid_amount_minor, currency: post.currency },
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (e) {
    return NextResponse.json(
      { error: friendlyError("resume-payment.createOrder", e, "Payments are temporarily unavailable — try again shortly.") },
      { status: 502 }
    );
  }
}
