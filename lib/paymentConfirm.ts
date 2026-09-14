import type { SupabaseClient } from "@supabase/supabase-js";

// The one place a payment_orders row (and its post) actually flips to
// "paid"/"live". Two different callers reach this — the Razorpay webhook
// (app/api/razorpay/webhook, always trusted, can lag by a few seconds) and
// the instant client-side confirmation (app/api/posts/[id]/confirm, backed
// by a real Razorpay-signed HMAC, usually near-instant) — so whichever
// arrives first wins and the other is just a no-op thanks to the `status
// === "paid"` guard below.
export async function markOrderPaid(
  sb: SupabaseClient,
  orderId: string,
  paymentId: string | null
): Promise<{ ok: boolean; alreadyPaid?: boolean; postId?: string; error?: string }> {
  const { data: order, error: orderErr } = await sb.from("payment_orders").select("*").eq("id", orderId).single();
  if (orderErr || !order) return { ok: false, error: "Unknown order." };
  if (order.status === "paid") return { ok: true, alreadyPaid: true, postId: order.post_id };

  const { error: payErr } = await sb
    .from("payment_orders")
    .update({ status: "paid", razorpay_payment_id: paymentId, paid_at: new Date().toISOString() })
    .eq("id", orderId);
  if (payErr) return { ok: false, error: payErr.message };

  const { data: post } = await sb.from("posts").select("tier").eq("id", order.post_id).single();
  const until = post && post.tier !== "std" ? new Date(Date.now() + 24 * 3600 * 1000).toISOString() : null;

  const { error: postErr } = await sb
    .from("posts")
    .update({ status: "live", paid_at: new Date().toISOString(), until })
    .eq("id", order.post_id)
    .eq("status", "pending_payment"); // guard: don't resurrect a post the author already deleted/cancelled
  if (postErr) return { ok: false, error: postErr.message };

  return { ok: true, postId: order.post_id };
}
