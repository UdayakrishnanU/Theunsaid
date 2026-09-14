import { ImageResponse } from "next/og";
import { supabaseAdmin } from "@/lib/supabase";
import { C, TC } from "@/lib/board-helpers";
import { loadBrandFonts } from "@/lib/og-font";
import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const alt = "AnonVerdict post";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

let logoDataUri: string | null = null;
async function getLogoDataUri(): Promise<string> {
  if (logoDataUri) return logoDataUri;
  const buf = await readFile(path.join(process.cwd(), "public", "anonverdict-logo.png"));
  logoDataUri = `data:image/png;base64,${buf.toString("base64")}`;
  return logoDataUri;
}

function summarize(text: string, max: number) {
  const t = (text || "").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut) + "…";
}

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sb = supabaseAdmin();
  const [{ data: post }, fonts, logo] = await Promise.all([
    sb.from("posts").select("*").eq("id", id).eq("hidden", false).single(),
    loadBrandFonts(),
    getLogoDataUri(),
  ]);

  const isDilemma = post?.type === "dilemma";
  const palette = (post && (C[post.category as string] || TC[post.type as string])) || C.all;
  const accent = palette.a;
  const tint = palette.t;
  const deep = palette.d;

  const text = summarize((post?.text as string) || "Someone needs the crowd's verdict.", isDilemma ? 150 : 210);

  const va = (post?.va as number) || 0;
  const vb = (post?.vb as number) || 0;
  const total = va + vb;
  const pa = total ? Math.round((va / total) * 100) : 50;
  const pb = 100 - pa;
  const category = post ? (post.category as string) : "dilemma";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: `linear-gradient(135deg, ${tint} 0%, #FAF9F5 62%)`,
          padding: "44px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
            background: "#FFFFFF",
            border: "1px solid #E5E9E0",
            borderRadius: 32,
            padding: "0 64px 46px 64px",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* top accent band */}
          <div style={{ display: "flex", position: "absolute", top: 0, left: 0, right: 0, height: 10, background: accent }} />

          {/* header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingTop: 46,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ display: "flex", width: 12, height: 12, borderRadius: 6, background: accent }} />
              <div
                style={{
                  display: "flex",
                  fontFamily: "Inter",
                  fontSize: 22,
                  fontWeight: 700,
                  letterSpacing: 3,
                  textTransform: "uppercase",
                  color: deep,
                }}
              >
                {category}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logo} width={34} height={34} style={{ borderRadius: 17 }} />
              <div style={{ display: "flex", fontFamily: "Inter", fontSize: 20, fontWeight: 700, color: "#141712" }}>
                AnonVerdict
              </div>
            </div>
          </div>

          {/* headline */}
          <div
            style={{
              display: "flex",
              fontFamily: "Newsreader",
              fontSize: 50,
              fontWeight: 700,
              color: "#141712",
              lineHeight: 1.32,
              maxWidth: 1010,
              marginTop: 18,
            }}
          >
            {`“${text}”`}
          </div>

          {/* footer block */}
          {isDilemma && post ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 10 }}>
              <div style={{ display: "flex", gap: 14 }}>
                <div
                  style={{
                    display: "flex",
                    flex: pa,
                    background: accent,
                    color: "#FFFFFF",
                    borderRadius: 999,
                    padding: "20px 30px",
                    fontFamily: "Inter",
                    fontSize: 26,
                    fontWeight: 700,
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span style={{ display: "flex" }}>{(post.option_a as string) || "Option A"}</span>
                  <span style={{ display: "flex" }}>{pa}%</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    flex: pb,
                    background: "#F1F0EA",
                    color: "#3A3F35",
                    borderRadius: 999,
                    padding: "20px 30px",
                    fontFamily: "Inter",
                    fontSize: 26,
                    fontWeight: 700,
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span style={{ display: "flex" }}>{(post.option_b as string) || "Option B"}</span>
                  <span style={{ display: "flex" }}>{pb}%</span>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontFamily: "Inter",
                  fontSize: 22,
                  color: "#697066",
                }}
              >
                <span style={{ display: "flex" }}>{total.toLocaleString()} strangers have voted</span>
                <span style={{ display: "flex", fontWeight: 700, color: deep }}>Cast yours at anonverdict.com →</span>
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontFamily: "Inter",
                fontSize: 22,
                color: "#697066",
                marginTop: 10,
              }}
            >
              <span style={{ display: "flex" }}>An anonymous confession</span>
              <span style={{ display: "flex", fontWeight: 700, color: deep }}>React at anonverdict.com →</span>
            </div>
          )}
        </div>
      </div>
    ),
    { ...size, ...(fonts.length ? { fonts } : {}) }
  );
}
