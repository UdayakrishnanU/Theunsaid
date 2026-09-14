import { supabaseAdmin } from "./supabase";
import type { Post } from "./types";
import type { CurrencyCode } from "./currency";

export function rowToPost(r: Record<string, unknown>): Post {
  return {
    id: r.id as string,
    type: r.type as Post["type"],
    category: r.category as Post["category"],
    text: r.text as string,
    oa: (r.option_a as string) ?? null,
    ob: (r.option_b as string) ?? null,
    bg: (r.bg as string) ?? "plain",
    tier: r.tier as Post["tier"],
    currency: r.currency as CurrencyCode,
    paid: (r.paid_base as number) ?? null,
    until: r.until ? new Date(r.until as string).getTime() : null,
    va: (r.va as number) ?? 0,
    vb: (r.vb as number) ?? 0,
    reactions: (r.reactions as Record<string, number>) ?? {},
    reports: (r.reports as number) ?? 0,
    hidden: !!r.hidden,
    outcome: (r.outcome as Post["outcome"]) ?? null,
    at: new Date(r.created_at as string).getTime(),
  };
}

export async function getLivePosts(limit = 1000): Promise<Post[]> {
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("posts")
      .select("id, type, category, text, option_a, option_b, bg, tier, currency, paid_base, until, va, vb, reactions, reports, hidden, outcome, created_at")
      .eq("status", "live")
      .eq("hidden", false)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error || !data) {
      console.error("Error fetching live posts from Supabase:", error);
      return [];
    }
    return data.map(rowToPost);
  } catch (err) {
    console.error("Exception in getLivePosts:", err);
    return [];
  }
}
