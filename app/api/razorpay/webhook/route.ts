import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { verifyWebhookSignature } from "@/lib/razorpay";

export const runtime = "nodejs";

// The critical piece the prep doc calls out: a post is marked `live` (and
// only then shows up on the board) from HERE, and nowhere else — after
// Razorpay's own signature-verified server-to-server callback confirms the
// payment actually happened. The client never gets to flip this switch.
//
// Configure this URL (https://yourdomain/api/razorpay/webhook) in the
// Razorpay dashboard under Settings -> Webhooks, subscribed to
// `payment.captured`, and copy the webhook secret it gives you into
// RAZORPAY_WEBHOOK_SECRET.
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const payload = JSON.parse(rawBody);
  const event = payload.event as string;

  if (event !== "payment.captured" && event !== "order.paid") {
    // Acknowledge anything else so Razorpay stops retrying it; we just don't act on it.
    return NextResponse.json({ ok: true, ignored: event });
  }

  const paymentEntity = payload.payload?.payment?.entity;
  const orderId: string | undefined = paymentEntity?.order_id ?? payload.payload?.order?.entity?.id;
  const paymentId: string | undefined = paymentEntity?.id;
  if (!orderId) return NextResponse.json({ ok: true, ignored: "no order id" });

  const sb = supabaseAdmin();

  const { data: order, error: orderErr } = await sb
    .from("payment_orders")
    .select("*")
    .eq("id", orderId)
    .single();
  if (orderErr || !order) {
    // Unknown order — don't 500 (Razorpay will keep retrying forever); just log-worthy no-op.
    return NextResponse.json({ ok: true, ignored: "unknown order" });
  }
  if (order.status === "paid") {
    return NextResponse.json({ ok: true, already: true }); // idempotent — webhooks can be delivered more than once
  }

  const { error: payErr } = await sb
    .from("payment_orders")
    .update({ status: "paid", razorpay_payment_id: paymentId, paid_at: new Date().toISOString() })
    .eq("id", orderId);
  if (payErr) return NextResponse.json({ error: payErr.message }, { status: 500 });

  const { data: post } = await sb.from("posts").select("tier").eq("id", order.post_id).single();
  const until = post && post.tier !== "std" ? new Date(Date.now() + 24 * 3600 * 1000).toISOString() : null;

  const { error: postErr } = await sb
    .from("posts")
    .update({ status: "live", paid_at: new Date().toISOString(), until })
    .eq("id", order.post_id)
    .eq("status", "pending_payment"); // guard: don't resurrect a post the author already deleted
  if (postErr) return NextResponse.json({ error: postErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
