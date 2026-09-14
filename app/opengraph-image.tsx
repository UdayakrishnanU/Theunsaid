import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import path from "path";
import { loadBrandFonts } from "@/lib/og-font";

export const runtime = "nodejs";
export const alt = "AnonVerdict — anonymous confessions, settled by strangers";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

let logoDataUri: string | null = null;
async function getLogoDataUri(): Promise<string> {
  if (logoDataUri) return logoDataUri;
  const buf = await readFile(path.join(process.cwd(), "public", "anonverdict-logo.png"));
  logoDataUri = `data:image/png;base64,${buf.toString("base64")}`;
  return logoDataUri;
}

export default async function Image() {
  const [logo, fonts] = await Promise.all([getLogoDataUri(), loadBrandFonts()]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "linear-gradient(135deg, #F5F3FF 0%, #FFF9EC 30%, #ECFDF5 62%, #FFF1F4 100%)",
          padding: "44px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            width: "100%",
            height: "100%",
            background: "#FFFFFF",
            border: "1px solid #E5E9E0",
            borderRadius: 32,
            position: "relative",
            overflow: "hidden",
            padding: "60px",
          }}
        >
          <div style={{ display: "flex", position: "absolute", top: 0, left: 0, right: 0, height: 10, background: "#141712" }} />

          <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 34 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} width={72} height={72} style={{ borderRadius: 36 }} />
            <div style={{ display: "flex", fontFamily: "Inter", fontSize: 44, fontWeight: 700, color: "#141712", letterSpacing: -1 }}>
              AnonVerdict
            </div>
          </div>

          <div
            style={{
              display: "flex",
              fontFamily: "Newsreader",
              fontSize: 54,
              fontWeight: 700,
              color: "#141712",
              textAlign: "center",
              lineHeight: 1.28,
              maxWidth: 940,
            }}
          >
            Say what you can&apos;t say anywhere else.
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: "Inter",
              fontSize: 28,
              fontWeight: 500,
              color: "#697066",
              marginTop: 24,
              textAlign: "center",
            }}
          >
            Thousands of strangers cast the verdict — anonymously.
          </div>
        </div>
      </div>
    ),
    { ...size, ...(fonts.length ? { fonts } : {}) }
  );
}
