import { NextRequest, NextResponse } from "next/server";
import { CUR, CurrencyCode } from "@/lib/currency";
import { supabaseAdmin } from "@/lib/supabase";
import { computePinFloor } from "@/lib/pinPricing";

export const runtime = "nodejs";

const CURRENCIES = Object.keys(CUR) as CurrencyCode[];

// GET /api/posts/pin-floor?currency=INR — what it actually costs right now to
// get on (or beat) the pinned shelf. The create-post modal calls this instead
// of estimating the price itself from whatever posts happen to be loaded on
// the board, so the number shown while typing a bid can never drift from what
// POST /api/posts will actually accept.
export async function GET(req: NextRequest) {
  const currency = req.nextUrl.searchParams.get("currency");
  if (!currency || !CURRENCIES.includes(currency as CurrencyCode)) {
    return NextResponse.json({ error: "Unknown currency." }, { status: 400 });
  }
  const sb = supabaseAdmin();
  const { floorBase, topBase } = await computePinFloor(sb, currency as CurrencyCode);
  return NextResponse.json({ floorBase, topBase });
}
