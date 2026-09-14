import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabase";
import seedRows from "@/scripts/db_rows.json";

export const runtime = "nodejs";

// The exact id list scripts/inject_seed.py wrote to `posts` — matching by id
// (not by date or any other heuristic) means this can never touch a real
// visitor's post, even one that happens to share a category or a created_at
// in the same window. Hides them the same way admin takedown does (reversible,
// nothing actually deleted), just for every seeded row at once instead of one
// at a time.
const SEED_IDS: string[] = (seedRows as { id: string }[]).map((r) => r.id);
const CHUNK = 50;

export async function POST() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sb = supabaseAdmin();

  let hidden = 0;
  for (let i = 0; i < SEED_IDS.length; i += CHUNK) {
    const chunk = SEED_IDS.slice(i, i + CHUNK);
    const { data, error } = await sb
      .from("posts")
      .update({ hidden: true, status: "hidden" })
      .in("id", chunk)
      .eq("hidden", false)
      .select("id");
    if (error) return NextResponse.json({ error: error.message, hiddenSoFar: hidden }, { status: 500 });
    hidden += data?.length ?? 0;
  }

  return NextResponse.json({ ok: true, hidden, total: SEED_IDS.length });
}
