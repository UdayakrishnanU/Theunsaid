import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { getOrderPaymentStatus } from "@/lib/cashfree";
import { markOrderPaid } from "@/lib/paymentConfirm";
import { friendlyError } from "@/lib/apiError";

export const runtime = "nodejs";

const schema = z.object({
  orderId: z.string().min(1),
});

// POST /api/posts/[id]/confirm — called right after Cashfree checkout reports
// success in the browser, to flip the post live in about a second instead of
// waiting on the webhook delivery time. The Cashfree webhook
// (app/api/cashfree/webhook) still runs independently as the authoritative
// safety net; both funnel through the idempotent markOrderPaid(), so whichever
// arrives first marks the post live and the other is a safe no-op.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid confirmation." }, { status: 400 });
  const { orderId } = parsed.data;

  const sb = supabaseAdmin();

  const { data: order } = await sb.from("payment_orders").select("post_id").eq("id", orderId).single();
  if (!order || order.post_id !== id) {
    return NextResponse.json({ error: "That order doesn't match this post." }, { status: 400 });
  }

  // Authoritative server-to-server verification directly with Cashfree
  const { paid, paymentId: cfPaymentId } = await getOrderPaymentStatus(orderId);
  if (!paid) return NextResponse.json({ error: "Could not verify that payment." }, { status: 400 });

  const result = await markOrderPaid(sb, orderId, cfPaymentId);
  if (!result.ok) return NextResponse.json({ error: friendlyError("posts.confirm", result.error) }, { status: 500 });

  return NextResponse.json({ ok: true, status: "live" });
}
