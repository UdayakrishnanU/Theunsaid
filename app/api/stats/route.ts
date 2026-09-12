import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

// Site-wide footer stats — deliberately shown "only once they are large enough
// to reassure rather than alarm," per the original's comment; the thresholding
// happens client-side in Footer.tsx, this just returns the raw numbers.
export async function GET() {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("posts")
    .select("va,vb,reactions,created_at")
    .eq("status", "live")
    .eq("hidden", false)
    .limit(5000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data ?? [];
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  let totalVotes = 0;
  let totalReactions = 0;
  let today = 0;
  for (const r of rows) {
    totalVotes += (r.va ?? 0) + (r.vb ?? 0);
    totalReactions += Object.values((r.reactions as Record<string, number>) ?? {}).reduce((a, b) => a + b, 0);
    if (new Date(r.created_at).getTime() > startOfDay.getTime()) today++;
  }
  return NextResponse.json({ total: rows.length, totalVotes, totalReactions, today });
}
