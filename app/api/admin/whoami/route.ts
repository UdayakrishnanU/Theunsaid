import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";

export const runtime = "nodejs";

// Lightweight, unauthenticated-safe check other client components can call
// to decide whether to show admin-only affordances (e.g. the Share Studio's
// "Developer options" drawer). Returns only a boolean — no data leaked.
export async function GET() {
  return NextResponse.json({ isAdmin: await isAdmin() });
}
