import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabase";
import { hashOwnerKey } from "@/lib/ownerKey";

export const runtime = "nodejs";
const schema = z.object({ ownerKey: z.string().min(4).max(16) });

// Recovery tool: a post's owner_key_hash is set once, at creation, from
// whatever device key was active in the browser at that moment. If that key
// is later lost client-side (cleared storage, a since-fixed bug that
// silently minted a new key on every fresh /mine load — see commit
// 50b2930), the post itself is never lost in the database, just orphaned:
// nothing currently in the poster's browser links back to it. This lets an
// admin manually re-point one post at a key its real owner can currently
// produce, once they've verified the post is actually theirs (e.g. they can
// describe its exact content, tier and rough posting time).
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid owner key (e.g. UN-AB3KX)." }, { status: 400 });

  const sb = supabaseAdmin();
  const ownerKeyHash = hashOwnerKey(parsed.data.ownerKey);
  const { data, error } = await sb
    .from("posts")
    .update({ owner_key_hash: ownerKeyHash })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "No post with that id." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
