import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabase";
import seedDays from "@/scripts/seed_v2_days.json";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// This route used to inject a brand-new day of synthetic launch content
// every ~20h, working through 30 pre-generated days from
// scripts/seed_v2_days.json. That drove ISR Writes usage far past the
// Vercel free-tier cap -- each new post is a brand-new /p/[id] and
// /p/[id]/opengraph-image cache entry the first time anything requests it --
// with zero real customers involved.
//
// New-day injection is switched off for good. Instead, this route RECYCLES
// content that is already in the `posts` table: it picks a batch of
// already-seeded posts and gives them a fresh created_at (spread over the
// trailing ~20h, the same way the old injection did) with va/vb/reactions
// reset to zero, so lib/engagementDrip.ts's ramp restarts and they read as
// freshly posted again. No new rows, no new ids, no new ISR paths -- this
// is an UPDATE to an id that is already cached, never an INSERT.
//
// Which batch gets recycled cycles deterministically through the whole pool
// of already-seeded posts, RECYCLE_BATCH at a time, wrapping back to the
// start once it reaches the end (see cycleWindow below) -- so the seed
// content keeps circulating in a loop forever instead of the board slowly
// going stale once no new days are being added.
//
// Wired to Vercel Cron (see vercel.json) to fire once a day; also callable
// manually by an admin.
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 3600 * 1000;
const CHUNK = 50;
const RECYCLE_BATCH = 350; // same felt volume as the old daily batches
// Fixed reference point for the cycle -- arbitrary, just needs to never
// move, so cycleStart below always advances by exactly one step per real
// day regardless of when this route happens to be redeployed.
const CYCLE_EPOCH_MS = Date.UTC(2026, 8, 21); // 2026-09-21

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
// day already been seeded" -- cheap to check (one `in` query) without a
// separate progress table. Recycling only ever touches days that already
// passed this check; there should be nothing left unseeded once this ships,
// since new-day injection is off.
const MARKER_IDS = DAYS.map((rows) => rows[0].id);

function isCronRequest(req: NextRequest): boolean {
  const ua = req.headers.get("user-agent") || "";
  return ua.includes("vercel-cron");
}

async function seededDayCount(sb: ReturnType<typeof supabaseAdmin>): Promise<number> {
  const { data, error } = await sb.from("posts").select("id").in("id", MARKER_IDS);
  if (error) throw error;
  const present = new Set((data ?? []).map((r) => r.id as string));
  let count = 0;
  for (const id of MARKER_IDS) {
    if (!present.has(id)) break;
    count++;
  }
  return count;
}

// start, start+1, ... start+count-1, each wrapped into [0, total).
function cycleWindow(total: number, start: number, count: number): number[] {
  const n = Math.min(count, total);
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push((start + i) % total);
  return out;
}

export async function GET(req: NextRequest) {
  const admin = await isAdmin();
  if (!admin && !isCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = supabaseAdmin();
  const seededDays = await seededDayCount(sb);
  if (seededDays === 0) {
    return NextResponse.json({ ok: true, message: "nothing seeded yet to recycle" });
  }

  const pool = DAYS.slice(0, seededDays).flat();
  const total = pool.length;

  const daysSinceEpoch = Math.floor((Date.now() - CYCLE_EPOCH_MS) / DAY_MS);
  const cycleStart = (((daysSinceEpoch * RECYCLE_BATCH) % total) + total) % total;
  const batch = cycleWindow(total, cycleStart, RECYCLE_BATCH).map((i) => pool[i]);

  const now = Date.now();
  const updates = batch.map((r) => {
    const createdAt = new Date(now - Math.random() * 20 * 3600 * 1000).toISOString();
    const until = r.tier !== "std" ? new Date(new Date(createdAt).getTime() + DAY_MS).toISOString() : null;
    return { id: r.id, created_at: createdAt, paid_at: createdAt, until, va: 0, vb: 0, reactions: {} };
  });

  let recycled = 0;
  for (let i = 0; i < updates.length; i += CHUNK) {
    const rawChunk = batch.slice(i, i + CHUNK);
    const chunk = updates.slice(i, i + CHUNK);
    const ids = chunk.map((u) => u.id);

    // These ids are supposed to already exist (seededDayCount only counts a
    // day in if its marker row is present), but that check doesn't confirm
    // every row of the day is still there -- a handful can be missing (never
    // persisted, or removed some other way). Upserting only the partial
    // update columns for a ghost id falls back to an INSERT with just those
    // columns, which blows up on every NOT NULL column we didn't list
    // (type, category, text, ...). Check existence first so the
    // partial-column path only ever runs for rows genuinely already there,
    // and re-insert any ghosts from their full seed data instead.
    const { data: existingRows, error: existErr } = await sb.from("posts").select("id").in("id", ids);
    if (existErr) {
      return NextResponse.json({ error: existErr.message, recycledSoFar: recycled }, { status: 500 });
    }
    const existingIds = new Set((existingRows ?? []).map((r) => r.id as string));

    const toUpdate: typeof chunk = [];
    const toReinsert: (SeedRow & (typeof chunk)[number])[] = [];
    for (let j = 0; j < chunk.length; j++) {
      if (existingIds.has(chunk[j].id)) {
        toUpdate.push(chunk[j]);
      } else {
        toReinsert.push({ ...rawChunk[j], ...chunk[j] });
      }
    }

    if (toUpdate.length > 0) {
      // onConflict without ignoreDuplicates: these ids are confirmed to
      // already exist, so this is an UPDATE of just the listed columns for
      // each matching row, never an insert.
      const { data, error } = await sb.from("posts").upsert(toUpdate, { onConflict: "id" }).select("id");
      if (error) {
        return NextResponse.json({ error: error.message, recycledSoFar: recycled }, { status: 500 });
      }
      recycled += data?.length ?? 0;
    }

    if (toReinsert.length > 0) {
      // Ghost ids: insert the full seed row (every NOT NULL column
      // populated) with the same recycled overrides applied on top.
      const { data, error } = await sb.from("posts").upsert(toReinsert, { onConflict: "id" }).select("id");
      if (error) {
        return NextResponse.json({ error: error.message, recycledSoFar: recycled }, { status: 500 });
      }
      recycled += data?.length ?? 0;
    }
  }

  return NextResponse.json({ ok: true, poolSize: total, cycleStart, recycled });
}
