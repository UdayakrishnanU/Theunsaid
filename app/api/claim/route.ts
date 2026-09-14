import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { hashOwnerKey } from "@/lib/ownerKey";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { friendlyError } from "@/lib/apiError";
import type { Post } from "@/lib/types";

export const runtime = "nodejs";

const schema = z.object({ ownerKey: z.string().min(4).max(16) });

function rowToPost(r: Record<string, unknown>): Post & { status: string } {
  return {
    id: r.id as string,
    type: r.type as Post["type"],
    category: r.category as Post["category"],
    text: r.text as string,
    oa: (r.option_a as string) ?? null,
    ob: (r.option_b as string) ?? null,
    bg: (r.bg as string) ?? "plain",
    tier: r.tier as Post["tier"],
    currency: r.currency as Post["currency"],
    paid: (r.paid_base as number) ?? null,
    until: r.until ? new Date(r.until as string).getTime() : null,
    va: (r.va as number) ?? 0,
    vb: (r.vb as number) ?? 0,
    reactions: (r.reactions as Record<string, number>) ?? {},
    reports: (r.reports as number) ?? 0,
    hidden: !!r.hidden,
    outcome: (r.outcome as Post["outcome"]) ?? null,
    at: new Date(r.created_at as string).getTime(),
    status: r.status as string,
  };
}

// Doubles as both "restore my posts on a new device" (original's claimByCode)
// and the data source for the My posts page — both are just "everything this
// key owns or engaged with, across every device it's ever been used from."
//
// Two kinds of result share one key: `posts` is everything created with this
// key (unchanged — owner_key_hash on the posts row itself), `engaged` is
// everything this key voted on or reacted to *without* creating it (owner_key_hash
// on the votes/reactions_log rows — see supabase/migrations/0008). A key with
// only engagement and no posts of its own is a normal, successful result now,
// not a 404 — only a key with neither returns "not found".
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const rl = await rateLimit(`claim:${ip}`, 20, 300);
  if (!rl.success) return NextResponse.json({ error: "Too many attempts. Try again shortly." }, { status: 429 });

  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Enter a key first." }, { status: 400 });

  const sb = supabaseAdmin();
  const ownerKeyHash = hashOwnerKey(parsed.data.ownerKey);

  // Lazy cleanup: a payment draft nobody ever finished (checkout closed, or
  // just abandoned) used to sit as "processing" on My posts forever with no
  // way out. Anything still pending 24h later is treated as abandoned —
  // this runs on every claim so no separate cron job is needed at this scale.
  await sb
    .from("posts")
    .update({ status: "deleted" })
    .eq("status", "pending_payment")
    .lt("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString());

  const { data: ownedRows, error: ownedErr } = await sb
    .from("posts")
    .select("*")
    .eq("owner_key_hash", ownerKeyHash)
    .eq("hidden", false)
    .neq("status", "deleted")
    .order("created_at", { ascending: false });
  if (ownedErr) return NextResponse.json({ error: friendlyError("claim.posts", ownedErr) }, { status: 500 });

  const posts = (ownedRows ?? []).map(rowToPost);
  const ownedIds = new Set(posts.map((p) => p.id));

  const [{ data: voteRows, error: voteErr }, { data: reactionRows, error: reactionErr }] = await Promise.all([
    sb.from("votes").select("post_id, side").eq("owner_key_hash", ownerKeyHash),
    sb.from("reactions_log").select("post_id, reaction_key").eq("owner_key_hash", ownerKeyHash),
  ]);
  if (voteErr) return NextResponse.json({ error: friendlyError("claim.votes", voteErr) }, { status: 500 });
  if (reactionErr) return NextResponse.json({ error: friendlyError("claim.reactions", reactionErr) }, { status: 500 });

  const voteByPost = new Map<string, "a" | "b">();
  for (const v of voteRows ?? []) voteByPost.set(v.post_id, v.side as "a" | "b");

  const reactionsByPost = new Map<string, string[]>();
  for (const r of reactionRows ?? []) {
    const cur = reactionsByPost.get(r.post_id) ?? [];
    cur.push(r.reaction_key);
    reactionsByPost.set(r.post_id, cur);
  }

  const engagedIds = [...new Set([...voteByPost.keys(), ...reactionsByPost.keys()])].filter((id) => !ownedIds.has(id));

  let engaged: (Post & { status: string; yourVote?: "a" | "b"; yourReactions?: string[] })[] = [];
  if (engagedIds.length) {
    const { data: engagedRows, error: engagedErr } = await sb
      .from("posts")
      .select("*")
      .in("id", engagedIds)
      .eq("hidden", false)
      .neq("status", "deleted");
    if (engagedErr) return NextResponse.json({ error: friendlyError("claim.engaged", engagedErr) }, { status: 500 });
    engaged = (engagedRows ?? [])
      .map((r) => {
        const p = rowToPost(r);
        const yourVote = voteByPost.get(p.id);
        const yourReactions = reactionsByPost.get(p.id);
        return { ...p, ...(yourVote ? { yourVote } : {}), ...(yourReactions ? { yourReactions } : {}) };
      })
      .sort((a, b) => b.at - a.at);
  }

  if (!posts.length && !engaged.length) {
    return NextResponse.json({ error: "No posts found under that key." }, { status: 404 });
  }

  return NextResponse.json({ posts, engaged });
}
