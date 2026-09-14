import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

export interface AdminPostItem {
  id: string;
  type: string;
  category: string;
  text: string;
  option_a: string | null;
  option_b: string | null;
  votes_a: number;
  votes_b: number;
  totalVotes: number;
  tier: "pin" | "glow" | "std";
  status: string;
  hidden: boolean;
  isPaid: boolean;
  paidAmountMinor: number;
  paidAmountFormatted: string;
  currency: string;
  createdAt: string;
  paidAt: string | null;
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sb = supabaseAdmin();

  const [postsRes, ordersRes] = await Promise.all([
    sb
      .from("posts")
      .select("id, type, category, text, option_a, option_b, va, vb, tier, status, hidden, paid_amount_minor, currency, created_at, paid_at")
      .order("created_at", { ascending: false })
      .limit(300),
    sb.from("payment_orders").select("post_id, amount_minor, currency, status").eq("status", "paid"),
  ]);

  const paidOrderAmounts = new Map<string, { minor: number; currency: string }>();
  for (const o of ordersRes.data ?? []) {
    if (o.amount_minor > 0) {
      paidOrderAmounts.set(o.post_id, { minor: o.amount_minor, currency: o.currency || "INR" });
    }
  }

  const posts: AdminPostItem[] = (postsRes.data ?? []).map((p) => {
    const orderPaid = paidOrderAmounts.get(p.id)?.minor ?? 0;
    const directPaid = p.paid_amount_minor ?? 0;
    const paidMinor = Math.max(orderPaid, directPaid);
    const isPaid = paidMinor > 0 || p.tier === "pin" || p.tier === "glow";
    const cur = p.currency || paidOrderAmounts.get(p.id)?.currency || "INR";
    const paidAmountFormatted = cur === "INR" ? `₹${(paidMinor / 100).toFixed(2)}` : `${cur} ${(paidMinor / 100).toFixed(2)}`;
    const va = p.va ?? 0;
    const vb = p.vb ?? 0;

    return {
      id: p.id,
      type: p.type || "confession",
      category: p.category || "general",
      text: p.text || "",
      option_a: p.option_a,
      option_b: p.option_b,
      votes_a: va,
      votes_b: vb,
      totalVotes: va + vb,
      tier: (p.tier as "pin" | "glow" | "std") || "std",
      status: p.status || "live",
      hidden: !!p.hidden,
      isPaid,
      paidAmountMinor: paidMinor,
      paidAmountFormatted,
      currency: cur,
      createdAt: p.created_at,
      paidAt: p.paid_at,
    };
  });

  return NextResponse.json({ posts });
}
