import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

// Read-only diagnostic: what's actually sitting in pending_payment right
// now, and how old each one is. Lets an admin tell a stalled/never-completed
// checkout apart from a post that's simply not live yet for some other
// reason, without needing DB access.
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("posts")
    .select("id, type, category, text, tier, currency, paid_amount_minor, created_at")
    .eq("status", "pending_payment")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ posts: data ?? [] });
}
