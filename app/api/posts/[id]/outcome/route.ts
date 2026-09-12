import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { hashOwnerKey } from "@/lib/ownerKey";
import { scan } from "@/lib/moderation";

export const runtime = "nodejs";

const schema = z.object({
  ownerKey: z.string().min(4).max(16),
  choice: z.enum(["a", "b", "other"]),
  note: z.string().max(220).optional().nullable(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid submission." }, { status: 400 });
  const { ownerKey, choice, note } = parsed.data;

  if (note) {
    const f = scan(note);
    if (f) return NextResponse.json({ error: f === "care" ? "Please reach out to someone who can help — findahelpline.com lists crisis lines worldwide." : f }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const { data: post, error } = await sb.from("posts").select("owner_key_hash").eq("id", id).single();
  if (error || !post) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (post.owner_key_hash !== hashOwnerKey(ownerKey)) {
    return NextResponse.json({ error: "That key doesn't own this post." }, { status: 403 });
  }

  const { error: updErr } = await sb
    .from("posts")
    .update({ outcome: { choice, note: note || null, at: Date.now() } })
    .eq("id", id);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
