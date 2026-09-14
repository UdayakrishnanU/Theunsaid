// Ported from unsaid-v30.html's client-side `scan()`, kept as the fast first-pass
// filter, plus a server-side OpenAI Moderation API call as the real backstop
// (the prep doc's "Phase 1" item: "Replaces the regex filter").
// Broadened from a strict 10-digit-only match (India format) to common
// international shapes too: an optional leading +country code, with the
// usual space/dash/dot/paren separators between groups.
const PII = [
  /\+?\d[\d\s().-]{6,14}\d/,
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/,
  /\b\d{4}\s?\d{4}\s?\d{4}\b/,
];
const CARE = [/suicide/i, /kill myself/i, /end my life/i, /want to die/i, /self.?harm/i, /cutting myself/i];
const SLUR = ["kill you", "rape"];

const HOMO: Record<string, string> = {
  а: "a", е: "e", о: "o", р: "p", с: "c", х: "x", і: "i", ѕ: "s", һ: "h", ԁ: "d", ᴏ: "o", ɡ: "g", ο: "o", Ρ: "p",
};

function normalise(t: string): string {
  let x = t.toLowerCase();
  for (const k in HOMO) x = x.split(k).join(HOMO[k]);
  return x.replace(/[^a-z0-9]/g, "");
}
const collapse = (x: string) => x.replace(/(.)\1+/g, "$1");

export type ScanResult = "care" | string | null;

/** Fast client- or server-side regex pass. Returns 'care' for crisis language,
 * a human-readable reason string for PII/slurs, or null if clean. */
export function scan(t: string): ScanResult {
  const l = t.toLowerCase();
  const n = normalise(t);
  const c = collapse(n);
  for (const r of CARE) if (r.test(l) || r.test(n) || r.test(c)) return "care";
  for (const r of PII) if (r.test(t)) return "That includes something that looks like a phone number, email or ID. Take it out — it could identify someone.";
  for (const s of SLUR) {
    const f = s.replace(/[^a-z0-9]/g, "");
    if (l.includes(s) || n.includes(f) || c.includes(collapse(f))) return "That reads as a threat or slur. Rewrite it and try again.";
  }
  return null;
}

/** Server-side backstop using the OpenAI Moderation API. No-ops (returns clean)
 * if OPENAI_API_KEY isn't set yet, so the app still runs before that's wired up. */
export async function moderateServerSide(text: string): Promise<{ flagged: boolean; categories?: string[] }> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { flagged: false };
  try {
    const res = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: "omni-moderation-latest", input: text }),
    });
    if (!res.ok) return { flagged: false };
    const data = await res.json();
    const result = data?.results?.[0];
    if (!result) return { flagged: false };
    const categories = Object.entries(result.categories || {})
      .filter(([, v]) => v)
      .map(([k]) => k);
    return { flagged: !!result.flagged, categories };
  } catch {
    return { flagged: false };
  }
}
