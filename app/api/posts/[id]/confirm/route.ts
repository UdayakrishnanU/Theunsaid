import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { verifyCheckoutSignature } from "@/lib/razorpay";
import { markOrderPaid } from "@/lib/paymentConfirm";
import { friendlyError } from "@/lib/apiError";

export const runtime = "nodejs";

const schema = z.object({
  orderId: z.string().min(1),
  paymentId: z.string().min(1),
  signature: z.string().min(1),
});

// POST /api/posts/[id]/confirm — called right after Razorpay Checkout
// reports success in the browser, with the signature Razorpay itself
// returned. That signature can only have been produced by Razorpay (it's an
// HMAC over orderId|paymentId using our server-side secret), so a verified
// one is real proof of payment — this lets the post go live in about a
// second instead of waiting on the webhook's own delivery time. The webhook
// (app/api/razorpay/webhook) still runs independently and is still the
// authoritative path; both funnel through the same idempotent
// markOrderPaid(), so whichever arrives first wins and the other is a no-op.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid confirmation." }, { status: 400 });
  const { orderId, paymentId, signature } = parsed.data;

  if (!verifyCheckoutSignature(orderId, paymentId, signature)) {
    return NextResponse.json({ error: "Could not verify that payment." }, { status: 400 });
  }

  const sb = supabaseAdmin();

  // The signature proves the payment is real; this makes sure it's being
  // applied to the post it actually belongs to.
  const { data: order } = await sb.from("payment_orders").select("post_id").eq("id", orderId).single();
  if (!order || order.post_id !== id) {
    return NextResponse.json({ error: "That order doesn't match this post." }, { status: 400 });
  }

  const result = await markOrderPaid(sb, orderId, paymentId);
  if (!result.ok) {
    return NextResponse.json({ error: friendlyError("posts.confirm", result.error) }, { status: 500 });
  }
  return NextResponse.json({ ok: true, status: "live" });
}
