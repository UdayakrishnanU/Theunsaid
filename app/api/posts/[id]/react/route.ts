import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { getOrCreateVoterId } from "@/lib/identity";
import { hashOwnerKey } from "@/lib/ownerKey";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { friendlyError } from "@/lib/apiError";

export const runtime = "nodejs";

const REACTION_KEYS = ["serious", "same", "redflag", "nailed", "inspo", "thought", "cant", "goforit"] as const;
// ownerKey is optional, same as vote/route.ts — hashed and stored purely for
// "My posts" retrieval, never for the one-reaction-per-person check.
const schema = z.object({ key: z.enum(REACTION_KEYS), ownerKey: z.string().min(4).max(16).optional() });

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const ip = clientIp(req);
  const rl = await rateLimit(`react:${ip}`, 60, 60);
  if (!rl.success) return NextResponse.json({ error: "Slow down a little." }, { status: 429 });

  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid reaction." }, { status: 400 });

  const voterId = await getOrCreateVoterId();
  const ownerKeyHash = parsed.data.ownerKey ? hashOwnerKey(parsed.data.ownerKey) : null;
  const sb = supabaseAdmin();
  const { data, error } = await sb.rpc("add_reaction", {
    p_post_id: id,
    p_voter_id: voterId,
    p_reaction_key: parsed.data.key,
    p_owner_key_hash: ownerKeyHash,
  });
  if (error) return NextResponse.json({ error: friendlyError("react", error) }, { status: 500 });
  return NextResponse.json({ reactions: data });
}
