import { createHmac, randomBytes } from "crypto";

// The device "key" (e.g. UN-AB3KX) is a bearer credential: whoever holds it can
// restore, edit or delete every post made with it, on any device (this mirrors
// the original prototype's design in unsaid-v30.html). We never store the raw
// code — only an HMAC of it, keyed by a server secret — so a database leak
// alone can't be used to impersonate posters.
function secret(): string {
  const s = process.env.OWNER_KEY_SECRET;
  if (!s) throw new Error("OWNER_KEY_SECRET is not set. Generate one with `openssl rand -hex 32` and add it to your env.");
  return s;
}

export function hashOwnerKey(code: string): string {
  return createHmac("sha256", secret()).update(code.trim().toUpperCase()).digest("hex");
}

export function mkOwnerCode(): string {
  // e.g. UN-7F3KQ — matches the original's mkCode() shape closely enough that
  // any codes users already saved from the prototype still look familiar.
  return "UN-" + randomBytes(4).toString("hex").toUpperCase().slice(0, 5);
}
