import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabase";
import seedDays from "@/scripts/seed_v2_days.json";

export const runtime = "nodejs";

// Drives the 30-day incremental injection of the synthetic launch-content
// seed (scripts/build_seed_v2.py builds scripts/seed_v2_days.json from the
// raw 10,500-row dataset — options truncated to fit the DB's 22-char
// constraint, ids/pricing/engagement all pre-generated per row).
//
// Day index is derived purely from elapsed wall-clock time since START_MS
// (the moment this was first deployed and kicked off) — deliberately no DB
// state to keep in sync or migration to run. Each call is idempotent: rows
// carry fixed, pre-generated ids and are upserted with ignoreDuplicates, so
// re-running the same day (Vercel Cron retry, a manual re-trigger, this
// route firing twice in one day) never double-inserts.
//
// Wired to Vercel Cron (see vercel.json) to fire once a day; also callable
// manually by an admin (e.g. to confirm today's batch went in).
const START_MS = 1789389685649; // 2026-09-14T12:41:25Z — kickoff moment
const DAY_MS = 24 * 3600 * 1000;
const TOTAL_DAYS = 30;
const CHUNK = 50;

type SeedRow = {
  id: string;
  type: string;
  category: string;
  text: string;
  option_a: string | null;
  option_b: string | null;
  bg: string;
  tier: string;
  status: string;
  owner_key_hash: string;
  currency: string;
  paid_amount_minor: number;
  paid_base: number;
  va: number;
  vb: number;
  reactions: Record<string, number>;
  reports: number;
  hidden: boolean;
  deleted_by_author: boolean;
  outcome: null;
  ip_hash: null;
};

const DAYS = seedDays as unknown as SeedRow[][];

function isCronRequest(req: NextRequest): boolean {
  const ua = req.headers.get("user-agent") || "";
  return ua.includes("vercel-cron");
}

export async function GET(req: NextRequest) {
  const admin = await isAdmin();
  if (!admin && !isCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const elapsed = Date.now() - START_MS;
  const dayIndex = Math.floor(elapsed / DAY_MS);

  if (dayIndex < 0) {
    return NextResponse.json({ ok: true, message: "before start window", startsInMs: -elapsed });
  }
  if (dayIndex >= TOTAL_DAYS) {
    return NextResponse.json({ ok: true, done: true, message: `all ${TOTAL_DAYS} days are past their injection window` });
  }

  const dayRows = DAYS[dayIndex];
  if (!dayRows || !dayRows.length) {
    return NextResponse.json({ error: `no seed data for day ${dayIndex}` }, { status: 500 });
  }

  // Spread each day's batch across the trailing ~20h ending now, so posts
  // look like they trickled in over the day rather than landing all at once.
  const now = Date.now();
  const rows = dayRows.map((r) => {
    const createdAt = new Date(now - Math.random() * 20 * 3600 * 1000).toISOString();
    const until = r.tier !== "std" ? new Date(new Date(createdAt).getTime() + DAY_MS).toISOString() : null;
    return { ...r, created_at: createdAt, paid_at: createdAt, until };
  });

  const sb = supabaseAdmin();
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { data, error } = await sb
      .from("posts")
      .upsert(chunk, { onConflict: "id", ignoreDuplicates: true })
      .select("id");
    if (error) {
      return NextResponse.json({ error: error.message, dayIndex, insertedSoFar: inserted }, { status: 500 });
    }
    inserted += data?.length ?? 0;
  }

  return NextResponse.json({
    ok: true,
    dayIndex,
    batchSize: rows.length,
    inserted,
    remainingDays: TOTAL_DAYS - dayIndex - 1,
  });
}
