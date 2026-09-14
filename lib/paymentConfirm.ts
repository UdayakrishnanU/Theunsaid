import type { SupabaseClient } from "@supabase/supabase-js";

// The one place a payment_orders row (and its post) actually flips to
// "paid"/"live". Four different callers reach this — the Razorpay and
// Cashfree webhooks (always trusted, can lag by a few seconds) and each
// gateway's own instant client-side confirmation route (near-instant) — so
// whichever arrives first wins and the rest are just no-ops thanks to the
// `status === "paid"` guard below. Which payment-id column gets the id
// depends on which gateway actually created the order (order.gateway).
export async function markOrderPaid(
  sb: SupabaseClient,
  orderId: string,
  paymentId: string | null
): Promise<{ ok: boolean; alreadyPaid?: boolean; postId?: string; error?: string }> {
  const { data: order, error: orderErr } = await sb.from("payment_orders").select("*").eq("id", orderId).single();
  if (orderErr || !order) return { ok: false, error: "Unknown order." };
  if (order.status === "paid") return { ok: true, alreadyPaid: true, postId: order.post_id };

  const updatePayload: Record<string, unknown> = {
    status: "paid",
    paid_at: new Date().toISOString(),
  };
  if (paymentId) {
    updatePayload.razorpay_payment_id = paymentId;
  }
  const { error: payErr } = await sb
    .from("payment_orders")
    .update(updatePayload)
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
