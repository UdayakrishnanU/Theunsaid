import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { getOrCreateVoterId } from "@/lib/identity";
import { hashOwnerKey } from "@/lib/ownerKey";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { friendlyError } from "@/lib/apiError";

export const runtime = "nodejs";

// ownerKey is optional — a visitor who hasn't generated one yet (or whose
// client is stale) still votes exactly as before. When present, it's hashed
// and stored alongside the vote purely so "My posts" can later show what this
// key voted on — it plays no role in the one-vote-per-person enforcement,
// which stays on the voter_id cookie below.
const schema = z.object({ side: z.enum(["a", "b"]), ownerKey: z.string().min(4).max(16).optional() });

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const ip = clientIp(req);
  const rl = await rateLimit(`vote:${ip}`, 60, 60); // 60 votes/min/IP — generous, this is the core loop
  if (!rl.success) return NextResponse.json({ error: "Slow down a little." }, { status: 429 });

  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid vote." }, { status: 400 });

  const voterId = await getOrCreateVoterId();
  const ownerKeyHash = parsed.data.ownerKey ? hashOwnerKey(parsed.data.ownerKey) : null;
  const sb = supabaseAdmin();
  const { data, error } = await sb.rpc("cast_vote", {
    p_post_id: id,
    p_voter_id: voterId,
    p_side: parsed.data.side,
    p_owner_key_hash: ownerKeyHash,
  });
  if (error) return NextResponse.json({ error: friendlyError("vote", error) }, { status: 500 });
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return NextResponse.json({ error: "Post not found." }, { status: 404 });
  return NextResponse.json({ va: row.va, vb: row.vb, alreadyVoted: row.already_voted });
}
