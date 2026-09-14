import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
const schema = z.object({ action: z.enum(["hide", "unhide"]) });

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid action." }, { status: 400 });

  const sb = supabaseAdmin();
  const hiding = parsed.data.action === "hide";
  // status: "hidden"/"live" alongside the boolean, so a takedown is
  // distinguishable from an owner's own delete (which sets status:
  // "deleted" — see app/api/posts/[id] DELETE) everywhere the two used to
  // look identical (My posts, the admin queue, support conversations).
  let q = sb.from("posts").update({ hidden: hiding, status: hiding ? "hidden" : "live" }).eq("id", id);
  if (!hiding) q = q.eq("status", "hidden"); // don't resurrect a post the author deleted or one still pending payment
  const { error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
