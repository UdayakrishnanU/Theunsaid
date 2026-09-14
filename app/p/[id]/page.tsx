import type { Metadata } from "next";
import { cache } from "react";
import { supabaseAdmin } from "@/lib/supabase";
import RedirectClient from "./RedirectClient";

export const runtime = "nodejs";

// cache() so generateMetadata (OG tags) and the page body below share one
// query per request instead of hitting the database twice for the same post.
const fetchPost = cache(async (id: string) => {
  const sb = supabaseAdmin();
  const { data, error } = await sb.from("posts").select("*").eq("id", id).eq("hidden", false).single();
  if (error || !data) return null;
  return data as Record<string, unknown>;
});

function summarize(text: string, max: number) {
  const t = (text || "").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut) + "…";
}

const FALLBACK_TITLE = "AnonVerdict — anonymous confessions, settled by strangers";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const post = await fetchPost(id);
  if (!post) return { title: FALLBACK_TITLE };

  const text = (post.text as string) || "";
  const isDilemma = post.type === "dilemma";
  const title = isDilemma
    ? `${(post.option_a as string) || "Option A"} or ${(post.option_b as string) || "Option B"}? — AnonVerdict`
    : `"${summarize(text, 70)}" — AnonVerdict`;
  const description = isDilemma
    ? summarize(text, 160)
    : "An anonymous confession. Read it and react — anonymously.";
  const url = `https://www.anonverdict.com/p/${id}`;

  return {
    title,
    description,
    openGraph: { title, description, type: "article", url },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = await fetchPost(id);
  // A dead or mistyped link used to just silently redirect to the homepage
  // with no explanation — the visitor had no way to tell whether they
  // mistyped it, the post was deleted, or it never existed.
  if (!post) {
    return (
      <div style={{ padding: "80px 24px", textAlign: "center" }}>
        <p style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", margin: "0 0 8px" }}>This post isn&apos;t available anymore.</p>
        <p style={{ color: "var(--faint)", margin: "0 0 20px" }}>It may have been taken down, or the link might be mistyped.</p>
        <a href="/" style={{ color: "var(--ink)", textDecoration: "underline", fontWeight: 600 }}>
          Go to the board →
        </a>
      </div>
    );
  }
  return <RedirectClient id={id} />;
}
