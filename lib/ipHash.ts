import { createHmac } from "crypto";

// Reuses the owner-key secret with a domain-separated prefix, rather than a
// second Vercel env var to set up -- an HMAC key is safe to reuse across
// purposes as long as the hashed input differs, which the "ip:" prefix
// guarantees here.
function secret(): string {
  const s = process.env.OWNER_KEY_SECRET;
  if (!s) throw new Error("OWNER_KEY_SECRET is not set. Generate one with `openssl rand -hex 32` and add it to your env.");
  return s;
}

/** One-way hash of a client IP, used only for IP-scoped soft vote dedup (see
 * app/api/posts/[id]/vote and the cast_vote() Postgres function). Never the
 * raw IP -- the request handler already sees that in clientIp(), and this
 * hash is what actually reaches the database and gets stored on the vote
 * row, so a database leak alone can't recover addresses. */
export function hashIp(ip: string): string {
  return createHmac("sha256", secret()).update("ip:" + ip).digest("hex");
}
