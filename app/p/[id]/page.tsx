import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabase";
import RedirectClient from "./RedirectClient";

export const runtime = "nodejs";

async function fetchPost(id: string) {
  const sb = supabaseAdmin();
  const { data, error } = await sb.from("posts").select("*").eq("id", id).eq("hidden", false).single();
  if (error || !data) return null;
  return data as Record<string, unknown>;
}

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
  return <RedirectClient id={id} />;
}
