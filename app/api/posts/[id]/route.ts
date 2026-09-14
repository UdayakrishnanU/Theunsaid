import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { hashOwnerKey } from "@/lib/ownerKey";
import { friendlyError } from "@/lib/apiError";
import { applyEngagementDrip } from "@/lib/engagementDrip";
import type { Post } from "@/lib/types";

export const runtime = "nodejs";

function rowToPost(r: Record<string, unknown>): Post {
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
  };
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const sb = supabaseAdmin();
  const { data, error } = await sb.from("posts").select("*").eq("id", id).eq("hidden", false).single();
  if (error || !data) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ post: applyEngagementDrip(rowToPost(data)) });
}

const delSchema = z.object({ ownerKey: z.string().min(4).max(16) });

// Author-initiated delete. Per the Terms ported into app/terms: the money is
// never refunded, but the post comes down and is removed from "my posts".
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = delSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Owner key required." }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: post, error } = await sb.from("posts").select("owner_key_hash").eq("id", id).single();
  if (error || !post) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (post.owner_key_hash !== hashOwnerKey(parsed.data.ownerKey)) {
    return NextResponse.json({ error: "That key doesn't own this post." }, { status: 403 });
  }

  const { error: updErr } = await sb
    .from("posts")
    // status: "deleted" (not just the hidden flag) so an owner-initiated
    // delete is distinguishable everywhere from an admin takedown — see
    // app/api/admin/posts/[id]/takedown, which uses status: "hidden" instead.
    .update({ hidden: true, deleted_by_author: true, status: "deleted" })
    .eq("id", id);
  if (updErr) return NextResponse.json({ error: friendlyError("posts.delete", updErr) }, { status: 500 });
  return NextResponse.json({ ok: true });
}
