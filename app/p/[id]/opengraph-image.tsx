import { ImageResponse } from "next/og";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const alt = "AnonVerdict post";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const CAT_COLORS: Record<string, string> = {
  relationships: "#F43F5E",
  work: "#0EA5E9",
  money: "#F59E0B",
  family: "#10B981",
  random: "#8B5CF6",
};

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
  const { data: post } = await sb.from("posts").select("*").eq("id", id).eq("hidden", false).single();

  const accent = (post && CAT_COLORS[post.category as string]) || "#141712";
  const isDilemma = post?.type === "dilemma";
  const text = summarize((post?.text as string) || "Someone needs the crowd's verdict.", isDilemma ? 150 : 200);

  const va = (post?.va as number) || 0;
  const vb = (post?.vb as number) || 0;
  const total = va + vb;
  const pa = total ? Math.round((va / total) * 100) : 50;
  const pb = 100 - pa;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#FAF9F5",
          padding: "70px 80px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 14, height: 14, borderRadius: "50%", background: accent }} />
          <div
            style={{
              display: "flex",
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "#697066",
            }}
          >
            {post ? (post.category as string) : "dilemma"} · AnonVerdict
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 52,
            fontWeight: 700,
            color: "#141712",
            lineHeight: 1.3,
            maxWidth: 1000,
          }}
        >
          {`"${text}"`}
        </div>

        {isDilemma && post ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", gap: 16 }}>
              <div
                style={{
                  display: "flex",
                  flex: pa,
                  background: accent,
                  color: "#FFFFFF",
                  borderRadius: 16,
                  padding: "18px 26px",
                  fontSize: 28,
                  fontWeight: 700,
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span>{(post.option_a as string) || "Option A"}</span>
                <span>{pa}%</span>
              </div>
              <div
                style={{
                  display: "flex",
                  flex: pb,
                  background: "#EDEBE3",
                  color: "#141712",
                  borderRadius: 16,
                  padding: "18px 26px",
                  fontSize: 28,
                  fontWeight: 700,
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span>{(post.option_b as string) || "Option B"}</span>
                <span>{pb}%</span>
              </div>
            </div>
            <div style={{ display: "flex", fontSize: 24, color: "#697066" }}>
              {total.toLocaleString()} strangers have voted — cast yours at anonverdict.com
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", fontSize: 28, color: "#697066" }}>
            Read it and react, anonymously — anonverdict.com
          </div>
        )}
      </div>
    ),
    { ...size }
  );
}
