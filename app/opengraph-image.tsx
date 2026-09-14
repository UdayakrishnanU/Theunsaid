import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import path from "path";

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
  const logo = await getLogoDataUri();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "linear-gradient(135deg, #FAF9F5 0%, #F3F5EE 55%, #ECEAE1 100%)",
          padding: "80px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 22, marginBottom: 40 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} width={84} height={84} style={{ borderRadius: "50%" }} />
          <div style={{ display: "flex", fontSize: 48, fontWeight: 800, color: "#141712", letterSpacing: -1 }}>
            AnonVerdict
          </div>
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 54,
            fontWeight: 700,
            color: "#141712",
            textAlign: "center",
            lineHeight: 1.25,
            maxWidth: 940,
          }}
        >
          Say what you can&apos;t say anywhere else.
        </div>
        <div style={{ display: "flex", fontSize: 30, color: "#697066", marginTop: 26, textAlign: "center" }}>
          Thousands of strangers cast the verdict — anonymously.
        </div>
      </div>
    ),
    { ...size }
  );
}
