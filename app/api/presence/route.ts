import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getOrCreateVoterId } from "@/lib/identity";

export const runtime = "nodejs";

// Real presence (ported from the original's heartbeat()), backed by a table
// instead of shared localStorage: "online now" = heartbeats in the last 5
// minutes, "visitors today" = distinct sessions first seen since midnight
// (server clock — good enough for a vanity counter, not a legal timestamp).
export async function POST() {
  const voterId = await getOrCreateVoterId();
  const sb = supabaseAdmin();
  const { data, error } = await sb.rpc("touch_presence", { p_session_id: voterId });
  if (error) return NextResponse.json({ online: 1, today: 1 });
  const row = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({ online: row?.online_now ?? 1, today: row?.today_count ?? 1 });
}
