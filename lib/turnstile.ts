// Cloudflare Turnstile — the prep doc's Phase 2 "bot blocking" item ("invisible
// to real users, free forever"). No-ops (always passes) when
// TURNSTILE_SECRET_KEY isn't set, so the app still runs before that's created.
export async function verifyTurnstile(token: string | undefined, remoteIp: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // not configured yet — don't block posting
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, remoteip: remoteIp }),
    });
    const data = await res.json();
    return !!data.success;
  } catch {
    return false;
  }
}
