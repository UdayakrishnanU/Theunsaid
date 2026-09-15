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
// Which day to seed next is read off the database itself (see
// findSeedProgress below), not computed from wall-clock time elapsed since
// some fixed deploy instant. The previous version anchored day boundaries to
// the exact moment this route was first deployed/kicked off; because Vercel
// Cron fires at a fixed time of day (see vercel.json) that didn't line up
// with that instant's time-of-day, the daily fire kept landing *before* that
// day's boundary rolled over, so it recomputed the same, already-seeded day
// index and inserted nothing — day 1 never went in even though day 0 had
// been live for over 20 hours. Deriving progress from what's actually in the
// posts table removes that whole class of drift: it cannot get stuck on a
// day that's already there, it cannot skip a day, and a missed cron fire
// (an outage, a deploy freeze) just catches up one day at a time on the next
// call instead of needing the elapsed-time math to line back up.
//
// Each call is still idempotent: rows carry fixed, pre-generated ids and are
// upserted with ignoreDuplicates, so re-running the same day (a Vercel Cron
// retry, a manual re-trigger, this route firing twice in a row) never
// double-inserts. MIN_GAP_MS is the other half of that: it paces progress to
// at most one day's batch per ~20 real hours, so a burst of manual/admin
// calls — or a retry landing sooner than expected — can't dump several days
// of "seed" content at once.
//
// Wired to Vercel Cron (see vercel.json) to fire once a day; also callable
// manually by an admin (e.g. to confirm today's batch went in, or to nudge
// it along after a missed fire).
const DAY_MS = 24 * 3600 * 1000;
const MIN_GAP_MS = 20 * 3600 * 1000;
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
// Each day's first row id is a stable, pre-generated marker for "has this
// day already been seeded" — cheap to check (one `in` query) without a
// separate progress table.
const MARKER_IDS = DAYS.map((rows) => rows[0].id);

function isCronRequest(req: NextRequest): boolean {
  const ua = req.headers.get("user-agent") || "";
  return ua.includes("vercel-cron");
}

async function findSeedProgress(
  sb: ReturnType<typeof supabaseAdmin>
): Promise<{ nextDayIndex: number | null; prevSeededAt: Date | null }> {
  const { data, error } = await sb.from("posts").select("id, created_at").in("id", MARKER_IDS);
  if (error) throw error;
  const seededAtById = new Map((data ?? []).map((r) => [r.id as string, new Date(r.created_at as string)]));
  for (let i = 0; i < MARKER_IDS.length; i++) {
    if (!seededAtById.has(MARKER_IDS[i])) {
      const prevSeededAt = i > 0 ? seededAtById.get(MARKER_IDS[i - 1]) ?? null : null;
      return { nextDayIndex: i, prevSeededAt };
    }
  }
  return { nextDayIndex: null, prevSeededAt: null };
}

export async function GET(req: NextRequest) {
  const admin = await isAdmin();
  if (!admin && !isCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = supabaseAdmin();
  const { nextDayIndex, prevSeededAt } = await findSeedProgress(sb);

  if (nextDayIndex === null) {
    return NextResponse.json({ ok: true, done: true, message: `all ${TOTAL_DAYS} days are already seeded` });
  }

  if (prevSeededAt) {
    const sinceMs = Date.now() - prevSeededAt.getTime();
    if (sinceMs < MIN_GAP_MS) {
      return NextResponse.json({ ok: true, message: "next day not due yet", nextDayIndex, readyInMs: MIN_GAP_MS - sinceMs });
    }
  }

  const dayIndex = nextDayIndex;
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
