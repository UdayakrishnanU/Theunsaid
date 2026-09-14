import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

// Polled by the post-payment screen while waiting for the Cashfree webhook to
// land (usually well under a few seconds, but never assumed instant).
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const sb = supabaseAdmin();
  const { data, error } = await sb.from("posts").select("status").eq("id", id).single();
  if (error || !data) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ status: data.status });
}
