import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { verifyWebhookSignature } from "@/lib/cashfree";
import { markOrderPaid } from "@/lib/paymentConfirm";

export const runtime = "nodejs";

// Authoritative payment completion: a post is marked `live` from HERE
// (or from the instant client-side confirm route, which verifies just
// as strictly server-to-server) and nowhere else.
//
// Configure this URL (https://yourdomain/api/cashfree/webhook) in the
// Cashfree dashboard under Developers -> Webhooks, subscribed to payment
// events. Cashfree signs with the same client secret used for API calls
// (CASHFREE_SECRET_KEY) — there's no separate webhook secret to copy in.
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-webhook-signature");
  const timestamp = req.headers.get("x-webhook-timestamp");

  if (!verifyWebhookSignature(rawBody, signature, timestamp)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const payload = JSON.parse(rawBody);
  const type = payload.type as string;

  if (type !== "PAYMENT_SUCCESS_WEBHOOK") {
    // Acknowledge anything else (failed/dropped/charges) so Cashfree stops
    // retrying it; we just don't act on it.
    return NextResponse.json({ ok: true, ignored: type });
  }

  const orderId: string | undefined = payload.data?.order?.order_id;
  const paymentId: string | undefined = payload.data?.payment?.cf_payment_id;
  if (!orderId) return NextResponse.json({ ok: true, ignored: "no order id" });

  const sb = supabaseAdmin();

  // markOrderPaid() is the same function the instant client-side confirm
  // route (app/api/posts/[id]/confirm) uses — idempotent either way, so
  // whichever of the two arrives first wins and this is a no-op for the other.
  const result = await markOrderPaid(sb, orderId, paymentId ?? null);
  if (!result.ok && result.error === "Unknown order.") {
    // Don't 500 (Cashfree will keep retrying forever); just a log-worthy no-op.
    return NextResponse.json({ ok: true, ignored: "unknown order" });
  }
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ ok: true, already: result.alreadyPaid ?? false });
}
