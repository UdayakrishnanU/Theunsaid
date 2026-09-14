import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getOrCreateVoterId } from "@/lib/identity";
import { recordDevicePing } from "@/lib/deviceTracker";
import { hashOwnerKey } from "@/lib/ownerKey";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const voterId = await getOrCreateVoterId();

  // Read client device headers
  const userAgent = req.headers.get("user-agent");
  const platform = req.headers.get("sec-ch-ua-platform");
  const mobile = req.headers.get("sec-ch-ua-mobile");

  // Optional ownerKey if client passed it
  let ownerKeyHash: string | null = null;
  try {
    const json = await req.json().catch(() => null);
    if (json?.ownerKey && typeof json.ownerKey === "string") {
      ownerKeyHash = hashOwnerKey(json.ownerKey);
    }
  } catch {
    // Plain POST without body
  }

  recordDevicePing(voterId, { userAgent, platform, mobile }, ownerKeyHash);

  const sb = supabaseAdmin();
  const { data, error } = await sb.rpc("touch_presence", { p_session_id: voterId });
  if (error) return NextResponse.json({ online: 1, today: 1 });
  const row = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({ online: row?.online_now ?? 1, today: row?.today_count ?? 1 });
}
