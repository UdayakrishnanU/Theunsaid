import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getOrCreateVoterId } from "@/lib/identity";
import { rateLimit, clientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

// Auto-hides at 5 reports (ported from the original) so it comes off the
// board immediately; the admin report queue (app/admin) is still where a
// human looks at it within the doc's 36-hour target, refund/permanent-removal
// decisions included.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const ip = clientIp(req);
  const rl = await rateLimit(`report:${ip}`, 20, 600);
  if (!rl.success) return NextResponse.json({ error: "Slow down a little." }, { status: 429 });

  const reporterId = await getOrCreateVoterId();
  const sb = supabaseAdmin();
  const { data, error } = await sb.rpc("file_report", { p_post_id: id, p_reporter_id: reporterId, p_reason: null });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const row = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({ reports: row?.reports ?? 0, hidden: row?.hidden ?? false });
}
