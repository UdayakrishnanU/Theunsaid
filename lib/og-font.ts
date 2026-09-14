// Loads Google Font bytes for use with next/og's ImageResponse. Satori (the
// renderer behind ImageResponse) can only parse TTF/OTF/WOFF, not WOFF2 — so
// we request Google's CSS with an old-Safari user agent, which is one of the
// few request shapes Google Fonts still answers with a TTF url instead of a
// WOFF2 one, then fetch that URL for the raw bytes.
//
// Network hiccups never break image generation: every call here is wrapped
// so a failure just means the card renders with Satori's default typeface
// instead of the brand font, not a broken/500 share image.

const OLD_SAFARI_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_6_8) AppleWebKit/534.57.2 (KHTML, like Gecko) Version/5.1.7 Safari/534.57.2";

export async function loadGoogleFont(family: string, weight: number): Promise<ArrayBuffer | null> {
  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`;
    const css = await fetch(cssUrl, { headers: { "User-Agent": OLD_SAFARI_UA } }).then((r) => r.text());
    const match = css.match(/src: url\(([^)]+)\) format\('(?:opentype|truetype)'\)/);
    if (!match) return null;
    const res = await fetch(match[1]);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

export type OgFont = { name: string; data: ArrayBuffer; weight: 400 | 500 | 600 | 700 | 800; style: "normal" };

export async function loadBrandFonts(): Promise<OgFont[]> {
  const [newsreader700, inter400, inter600, inter700] = await Promise.all([
    loadGoogleFont("Newsreader", 700),
    loadGoogleFont("Inter", 400),
    loadGoogleFont("Inter", 600),
    loadGoogleFont("Inter", 700),
  ]);
  const fonts: OgFont[] = [];
  if (newsreader700) fonts.push({ name: "Newsreader", data: newsreader700, weight: 700, style: "normal" });
  if (inter400) fonts.push({ name: "Inter", data: inter400, weight: 400, style: "normal" });
  if (inter600) fonts.push({ name: "Inter", data: inter600, weight: 600, style: "normal" });
  if (inter700) fonts.push({ name: "Inter", data: inter700, weight: 700, style: "normal" });
  return fonts;
}
