import type { SupabaseClient } from "@supabase/supabase-js";
import type { CurrencyCode } from "./currency";
import { minBidBase, BID_STEP } from "./currency";
import { SLOTS } from "./board-helpers";

// Server-side pin-shelf pricing — the one place that decides what it costs to
// get (or beat) the pinned shelf. Used by both POST /api/posts (the actual
// price check at submit time) and GET /api/posts/pin-floor (what the
// create-post form displays while you're typing a bid), so the two can never
// show a different number than the one that's actually charged.
export async function computePinFloor(
  sb: SupabaseClient,
  currency: CurrencyCode
): Promise<{ floorBase: number; topBase: number }> {
  const { data: shelfRows } = await sb
    .from("posts")
    .select("paid_base")
    .eq("status", "live")
    .eq("tier", "pin")
    .gt("until", new Date().toISOString())
    .order("paid_base", { ascending: false })
    .limit(SLOTS);
  const shelf = (shelfRows ?? []) as { paid_base: number }[];
  const floorBase =
    shelf.length < SLOTS
      ? minBidBase(currency)
      : Math.max(shelf[shelf.length - 1].paid_base + BID_STEP, minBidBase(currency));
  const topBase = shelf.length ? Math.max(shelf[0].paid_base + BID_STEP, minBidBase(currency)) : minBidBase(currency);
  return { floorBase, topBase };
}
