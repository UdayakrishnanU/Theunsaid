import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

export interface AdminOrderItem {
  id: string;
  postId: string;
  postText: string;
  category: string;
  tier: string;
  amountMinor: number;
  amountFormatted: string;
  currency: string;
  status: "paid" | "created" | "failed";
  gateway: string;
  paymentId: string | null;
  createdAt: string;
  paidAt: string | null;
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sb = supabaseAdmin();

  const [ordersRes, postsRes] = await Promise.all([
    sb.from("payment_orders").select("*").order("created_at", { ascending: false }).limit(200),
    sb.from("posts").select("id, text, category, tier"),
  ]);

  const postsMap = new Map<string, { text: string; category: string; tier: string }>();
  for (const p of postsRes.data ?? []) {
    postsMap.set(p.id, { text: p.text, category: p.category, tier: p.tier });
  }

  const orders: AdminOrderItem[] = (ordersRes.data ?? []).map((o) => {
    const postInfo = postsMap.get(o.post_id);
    const amountMinor = o.amount_minor ?? 0;
    const cur = o.currency || "INR";
    const amountFormatted = cur === "INR" ? `₹${(amountMinor / 100).toFixed(2)}` : `${cur} ${(amountMinor / 100).toFixed(2)}`;

    return {
      id: o.id,
      postId: o.post_id,
      postText: postInfo ? postInfo.text.slice(0, 80) : "Unknown post",
      category: postInfo?.category ?? "General",
      tier: postInfo?.tier ?? "std",
      amountMinor,
      amountFormatted,
      currency: cur,
      status: o.status,
      gateway: o.gateway || "cashfree",
      paymentId: o.cf_payment_id || o.razorpay_payment_id || null,
      createdAt: o.created_at,
      paidAt: o.paid_at,
    };
  });

  return NextResponse.json({ orders });
}
