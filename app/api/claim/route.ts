import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { hashOwnerKey } from "@/lib/ownerKey";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import type { Post } from "@/lib/types";

export const runtime = "nodejs";

const schema = z.object({ ownerKey: z.string().min(4).max(16) });

// Doubles as both "restore my posts on a new device" (original's claimByCode)
// and the data source for the My posts page — both are just "everything this
// key owns, across every device it's ever been used from."
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const rl = await rateLimit(`claim:${ip}`, 20, 300);
  if (!rl.success) return NextResponse.json({ error: "Too many attempts. Try again shortly." }, { status: 429 });

  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Enter a key first." }, { status: 400 });

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("posts")
    .select("*")
    .eq("owner_key_hash", hashOwnerKey(parsed.data.ownerKey))
    .eq("hidden", false)
    .neq("status", "deleted")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || !data.length) return NextResponse.json({ error: "No posts found under that key." }, { status: 404 });

  const posts: (Post & { status: string })[] = data.map((r) => ({
    id: r.id,
    type: r.type,
    category: r.category,
    text: r.text,
    oa: r.option_a ?? null,
    ob: r.option_b ?? null,
    bg: r.bg ?? "plain",
    tier: r.tier,
    currency: r.currency,
    paid: r.paid_base ?? null,
    until: r.until ? new Date(r.until).getTime() : null,
    va: r.va ?? 0,
    vb: r.vb ?? 0,
    reactions: r.reactions ?? {},
    reports: r.reports ?? 0,
    hidden: !!r.hidden,
    outcome: r.outcome ?? null,
    at: new Date(r.created_at).getTime(),
    status: r.status,
  }));
  return NextResponse.json({ posts });
}
