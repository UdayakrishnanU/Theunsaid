import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sb = supabaseAdmin();

  const [{ count: liveCount }, { count: pendingCount }, { count: reportedCount }, { data: paidOrders }] = await Promise.all([
    sb.from("posts").select("id", { count: "exact", head: true }).eq("status", "live").eq("hidden", false),
    sb.from("posts").select("id", { count: "exact", head: true }).eq("status", "pending_payment"),
    sb.from("posts").select("id", { count: "exact", head: true }).gt("reports", 0).eq("hidden", false),
    sb.from("payment_orders").select("amount_minor,currency,paid_at").eq("status", "paid"),
  ]);

  const revenueByCurrency: Record<string, number> = {};
  let last24hCount = 0;
  const dayAgo = Date.now() - 24 * 3600 * 1000;
  for (const o of paidOrders ?? []) {
    revenueByCurrency[o.currency] = (revenueByCurrency[o.currency] ?? 0) + o.amount_minor;
    if (o.paid_at && new Date(o.paid_at).getTime() > dayAgo) last24hCount++;
  }

  return NextResponse.json({
    liveCount: liveCount ?? 0,
    pendingCount: pendingCount ?? 0,
    reportedCount: reportedCount ?? 0,
    paidOrderCount: paidOrders?.length ?? 0,
    last24hPaidCount: last24hCount,
    revenueByCurrency, // minor units per currency — divide by 100 to display
  });
}
