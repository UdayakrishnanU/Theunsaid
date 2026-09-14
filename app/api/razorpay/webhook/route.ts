import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { markOrderPaid } from "@/lib/paymentConfirm";

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

  // markOrderPaid() is the same function the instant client-side confirmation
  // (app/api/posts/[id]/confirm) uses — idempotent either way, so whichever
  // of the two arrives first wins and this is just a no-op for the other.
  const result = await markOrderPaid(sb, orderId, paymentId ?? null);
  if (!result.ok && result.error === "Unknown order.") {
    // Don't 500 (Razorpay will keep retrying forever); just a log-worthy no-op.
    return NextResponse.json({ ok: true, ignored: "unknown order" });
  }
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ ok: true, already: result.alreadyPaid ?? false });
}
