import { cookies } from "next/headers";
import { randomUUID } from "crypto";

const VOTER_COOKIE = "unsaid_voter";
const YEAR = 60 * 60 * 24 * 365;

/** Anonymous per-browser voter id, used server-side to enforce one vote / one
 * reaction / one report per person per post (votes.unique(post_id, voter_id)
 * etc). Not linked to any identity — just an opaque random id in an httpOnly
 * cookie. Must be called from a Route Handler or Server Action (cookie writes
 * aren't allowed from plain server components). */
export async function getOrCreateVoterId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(VOTER_COOKIE)?.value;
  if (existing) return existing;
  const id = randomUUID();
  store.set(VOTER_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: YEAR * 2,
    path: "/",
  });
  return id;
}
