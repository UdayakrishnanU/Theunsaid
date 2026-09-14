// Pure helpers ported from unsaid-v30.html, shared by client components.
import type { Post } from "./types";
import { CUR, CurrencyCode, fmt, fromBase, minBidBase, BID_STEP } from "./currency";

export const CATS: [string, string][] = [
  ["all", "Everything"],
  ["relationships", "Relationships"],
  ["work", "Work"],
  ["money", "Money"],
  ["family", "Family"],
  ["random", "Random"],
];

export interface BoostedShade {
  key: string;
  label: string;
  accent: string;
  border: string;
  bgLight: string;
  bgGradient: string;
  textDark: string;
  badgeBg: string;
  glowShadow: string;
}

export const BOOSTED_SHADES: Record<string, BoostedShade> = {
  rose: {
    key: "rose",
    label: "Rose Blush",
    accent: "#F43F5E",
    border: "#FDA4AF",
    bgLight: "#FFF1F4",
    bgGradient: "linear-gradient(135deg, rgba(255, 241, 242, 0.85) 0%, rgba(255, 255, 255, 0.98) 45%, rgba(255, 228, 230, 0.6) 100%)",
    textDark: "#BE123C",
    badgeBg: "linear-gradient(135deg, #FF2E7E, #F43F5E)",
    glowShadow: "0 4px 20px -2px rgba(244, 63, 94, 0.16), 0 2px 6px -1px rgba(244, 63, 94, 0.08)",
  },
  sunset: {
    key: "sunset",
    label: "Sunset Aura",
    accent: "#F97316",
    border: "#FDBA74",
    bgLight: "#FFF7ED",
    bgGradient: "linear-gradient(135deg, rgba(255, 237, 213, 0.85) 0%, rgba(255, 255, 255, 0.98) 45%, rgba(254, 215, 170, 0.6) 100%)",
    textDark: "#C2410C",
    badgeBg: "linear-gradient(135deg, #FB923C, #EA580C)",
    glowShadow: "0 4px 20px -2px rgba(249, 115, 22, 0.16), 0 2px 6px -1px rgba(249, 115, 22, 0.08)",
  },
  violet: {
    key: "violet",
    label: "Cyber Violet",
    accent: "#8B5CF6",
    border: "#C4B5FD",
    bgLight: "#F5F3FF",
    bgGradient: "linear-gradient(135deg, rgba(243, 232, 255, 0.85) 0%, rgba(255, 255, 255, 0.98) 45%, rgba(233, 213, 255, 0.6) 100%)",
    textDark: "#6D28D9",
    badgeBg: "linear-gradient(135deg, #A855F7, #7C3AED)",
    glowShadow: "0 4px 20px -2px rgba(139, 92, 246, 0.16), 0 2px 6px -1px rgba(139, 92, 246, 0.08)",
  },
  sky: {
    key: "sky",
    label: "Electric Sky",
    accent: "#0284C7",
    border: "#7DD3FC",
    bgLight: "#F0F9FF",
    bgGradient: "linear-gradient(135deg, rgba(224, 242, 254, 0.85) 0%, rgba(255, 255, 255, 0.98) 45%, rgba(186, 230, 253, 0.6) 100%)",
    textDark: "#0369A1",
    badgeBg: "linear-gradient(135deg, #38BDF8, #0284C7)",
    glowShadow: "0 4px 20px -2px rgba(2, 132, 199, 0.16), 0 2px 6px -1px rgba(2, 132, 199, 0.08)",
  },
  mint: {
    key: "mint",
    label: "Neon Mint",
    accent: "#10B981",
    border: "#6EE7B7",
    bgLight: "#ECFDF5",
    bgGradient: "linear-gradient(135deg, rgba(209, 250, 229, 0.85) 0%, rgba(255, 255, 255, 0.98) 45%, rgba(167, 243, 208, 0.6) 100%)",
    textDark: "#047857",
    badgeBg: "linear-gradient(135deg, #34D399, #059669)",
    glowShadow: "0 4px 20px -2px rgba(16, 185, 129, 0.16), 0 2px 6px -1px rgba(16, 185, 129, 0.08)",
  },
  amber: {
    key: "amber",
    label: "Golden Amber",
    accent: "#D97706",
    border: "#FCD34D",
    bgLight: "#FFFBEB",
    bgGradient: "linear-gradient(135deg, rgba(254, 243, 199, 0.85) 0%, rgba(255, 255, 255, 0.98) 45%, rgba(253, 230, 138, 0.6) 100%)",
    textDark: "#92400E",
    badgeBg: "linear-gradient(135deg, #FBBF24, #D97706)",
    glowShadow: "0 4px 20px -2px rgba(217, 119, 6, 0.16), 0 2px 6px -1px rgba(217, 119, 6, 0.08)",
  },
};

export const CAT_META: Record<string, { label: string; icon: string; bg: string; border: string; text: string }> = {
  relationships: { label: "Relationships", icon: "❤️", bg: "#FFF1F4", border: "#FFE4E6", text: "#E11D48" },
  work: { label: "Career", icon: "💼", bg: "#F5F3FF", border: "#EDE9FE", text: "#6D28D9" },
  money: { label: "Money", icon: "💰", bg: "#FFFBEB", border: "#FEF3C7", text: "#B45309" },
  family: { label: "Family", icon: "👨‍👩‍👧", bg: "#ECFDF5", border: "#D1FAE5", text: "#047857" },
  random: { label: "Random", icon: "🎲", bg: "#EFF6FF", border: "#DBEAFE", text: "#1D4ED8" },
};

export function formatScore(n: number): string {
  if (!n || isNaN(n)) return "0";
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toString();
}

// A fresh post used to show its tier's full view-count floor (1.2k for a
// brand-new std post, etc) from the very first render -- a 3-vote post
// jumping straight to "1.2k views" reads as fake. Views now ramp in over
// the first few hours instead of appearing instantly: `rampedFloor` blends
// from a small starting value up to the same floor the formula always
// used, on an ease-out curve (fast at first, leveling off), keyed off how
// long the post has actually existed (`post.at`). Once real engagement
// pushes the organic total past the floor, the floor stops mattering at
// all -- this only changes the early, low-engagement window.
function rampedFloor(tierFloor: number, startFloor: number, ageMs: number, rampHours: number): number {
  const rampMs = rampHours * 3600 * 1000;
  if (ageMs <= 0) return startFloor;
  if (ageMs >= rampMs) return tierFloor;
  const t = ageMs / rampMs;
  const eased = 1 - Math.pow(1 - t, 2); // ease-out: quick early growth, slows near the floor
  return Math.round(startFloor + (tierFloor - startFloor) * eased);
}

export function calcViews(post: Post): string {
  const votes = (post.va || 0) + (post.vb || 0);
  const reacts = Object.values(post.reactions || {}).reduce((a, b) => a + b, 0);
  const totalEng = votes + reacts;
  const ageMs = Date.now() - post.at;
  if (post.tier === "pin") {
    const floor = rampedFloor(25600, 900, ageMs, 6);
    const base = Math.max(floor, totalEng * 12 + 18000);
    return formatScore(base);
  }
  if (post.tier === "glow") {
    const floor = rampedFloor(8400, 260, ageMs, 6);
    const base = Math.max(floor, totalEng * 10 + 6200);
    return formatScore(base);
  }
  const floor = rampedFloor(1200, 40, ageMs, 6);
  const base = Math.max(floor, totalEng * 8 + 450);
  return formatScore(base);
}

export const C: Record<string, { a: string; t: string; d: string }> = {
  relationships: { a: "#F43F5E", t: "#FFF1F4", d: "#9F1239" },
  work: { a: "#0EA5E9", t: "#EFF9FE", d: "#075985" },
  money: { a: "#F59E0B", t: "#FFF9EC", d: "#92400E" },
  family: { a: "#10B981", t: "#ECFDF5", d: "#065F46" },
  random: { a: "#8B5CF6", t: "#F5F3FF", d: "#5B21B6" },
  all: { a: "#171A21", t: "#FFF", d: "#171A21" },
};

export const TC: Record<string, { a: string; t: string; d: string }> = {
  confession: { a: "#F43F5E", t: "#FFF1F4", d: "#9F1239" },
  dilemma: { a: "#0EA5E9", t: "#EFF9FE", d: "#075985" },
};

export const CHIPS: [string, string, string][] = [
  ["serious", "😳", "Are you serious?"],
  ["same", "😭", "Same here"],
  ["redflag", "🚩", "Red flag"],
  ["nailed", "🔥", "You nailed it"],
  ["inspo", "🌟", "You're my inspiration"],
  ["thought", "🤔", "Never saw it that way"],
  ["cant", "💀", "I can't even"],
  ["goforit", "🙌", "Go for it"],
];

export const BGS: [string, string][] = [
  ["plain", "Plain"], ["dots", "Dots"], ["grid", "Grid"], ["rings", "Rings"],
  ["stripes", "Stripes"], ["waves", "Waves"], ["confetti", "Confetti"],
];

export const SORTS: [string, string][] = [
  ["trending", "Trending"], ["new", "Last 24 hours"], ["needy", "Needs your votes"], ["boosted", "Boosted"],
];

const H = 36e5;

export const nf = (n: number) => n.toLocaleString("en-IN");
export function ago(t: number): string {
  const m = Math.floor((Date.now() - t) / 6e4);
  if (m < 1) return "just now";
  if (m < 60) return m + "m ago";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h ago";
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : d + "d ago";
}

export const liveP = (p: Post) => !!p.until && p.until > Date.now();
export const isPin = (p: Post) => p.tier === "pin" && liveP(p);
export const isGlow = (p: Post) => p.tier === "glow" && liveP(p);
export const rsum = (p: Post) => Object.values(p.reactions || {}).reduce((a, b) => a + b, 0);
export const vsum = (p: Post) => (p.va || 0) + (p.vb || 0);
export const eng = (p: Post) => rsum(p) + vsum(p);
export const heat = (p: Post) => eng(p) / Math.pow(Math.max(1, (Date.now() - p.at) / H), 0.62);
// "Last 24 hours" tab / trending float — widened from a 2h window so it
// reflects actual recent activity instead of going empty within minutes on
// a quiet board.
export const isFresh = (p: Post) => Date.now() - p.at < 24 * H;
export const needsVotes = (votedIds: Set<string>) => (p: Post) =>
  !votedIds.has(p.id) && (p.type === "dilemma" ? vsum(p) < 400 : eng(p) < 40);

export const SLOTS = 1;

export function liveBids(list: Post[]): Post[] {
  return list.filter((p) => p.tier === "pin" && liveP(p) && (p.paid || 0) > 0).sort((a, b) => (b.paid || 0) - (a.paid || 0));
}
export function shelfOf(list: Post[]): Post[] {
  return liveBids(list).slice(0, SLOTS);
}
export function outbidOf(list: Post[]): Post[] {
  return liveBids(list).slice(SLOTS);
}
export function floorBidBase(list: Post[], code: CurrencyCode): number {
  const s = shelfOf(list);
  const f = s.length < SLOTS ? minBidBase(code) : (s[s.length - 1].paid || minBidBase(code)) + BID_STEP;
  return Math.max(f, minBidBase(code));
}
export function topBidBase(list: Post[], code: CurrencyCode): number {
  const s = shelfOf(list);
  return s.length ? Math.max((s[0].paid || 0) + BID_STEP, minBidBase(code)) : minBidBase(code);
}

export function rupee(base: number, code: CurrencyCode): string {
  return fmt(fromBase(base, code), code);
}

export function cc(key: string) {
  return C[key] || C.all;
}
export function tvars(p: Post) {
  const catKey = (p.category || "").toLowerCase();
  const x = C[catKey] || TC[p.type] || TC.confession;
  return { "--acc": x.a, "--tint": x.t, "--deep": x.d } as React.CSSProperties;
}

// Boosted (glow-tier) posts get one fixed, category-independent identity —
// violet — instead of borrowing whatever color the post's own category
// happens to use. That way "boosted" always reads as its own distinct
// thing, never blending in with (or duplicating) a default card's color.
export const GLOW_ACCENT = "#8B5CF6";
export const GLOW_TINT = "#F5F3FF";
export const GLOW_DEEP = "#5B21B6";
export const GLOW_VARS = { "--acc": GLOW_ACCENT, "--tint": GLOW_TINT, "--deep": GLOW_DEEP } as React.CSSProperties;

// Display-only text splitting for post/confession cards: shows a short bold
// headline with the remainder as a smaller, muted line underneath. Purely
// cosmetic — never changes how a post is stored or submitted.
export function splitHeadline(text: string): { headline: string; rest: string | null } {
  if (text.length <= 90) return { headline: text, rest: null };

  const searchEnd = Math.min(130, text.length);
  let cut = -1;
  for (let i = 24; i < searchEnd; i++) {
    const ch = text[i];
    if (ch === "." || ch === "!" || ch === "?") {
      cut = i;
      break;
    }
  }

  if (cut !== -1) {
    const headline = text.slice(0, cut + 1).trim();
    const rest = text.slice(cut + 1).trim();
    return { headline, rest: rest.length ? rest : null };
  }

  const fallbackLimit = 90;
  let breakAt = text.lastIndexOf(" ", fallbackLimit);
  if (breakAt <= 0) breakAt = fallbackLimit;
  const headline = text.slice(0, breakAt).trim() + "…";
  const rest = text.slice(breakAt).trim();
  return { headline, rest: rest.length ? rest : null };
}

export function bgCss(bg: string, acc: string): string {
  const a = acc + "2E", b = acc + "1A";
  switch (bg) {
    case "dots": return `radial-gradient(${a} 1.6px, transparent 1.6px)`;
    case "grid": return `linear-gradient(${b} 1px, transparent 1px), linear-gradient(90deg, ${b} 1px, transparent 1px)`;
    case "rings": return `repeating-radial-gradient(circle at 88% 12%, ${b} 0 1px, transparent 1px 22px)`;
    case "stripes": return `repeating-linear-gradient(135deg, ${b} 0 2px, transparent 2px 16px)`;
    case "waves": return `repeating-radial-gradient(circle at 0 100%, transparent 0 16px, ${b} 16px 17px)`;
    case "confetti": return `radial-gradient(${a} 2px, transparent 2px), radial-gradient(${b} 2px, transparent 2px)`;
    default: return "none";
  }
}
export function bgSize(bg: string): string {
  return ({ dots: "18px 18px", grid: "26px 26px", rings: "auto", stripes: "auto", waves: "auto", confetti: "30px 30px, 30px 30px" } as Record<string, string>)[bg] || "auto";
}
export const bgPos = (bg: string) => (bg === "confetti" ? "0 0, 15px 15px" : "0 0");

export function shareText(p: Post): string {
  if (p.type === "dilemma") {
    const t = vsum(p);
    const pa = t ? Math.round((p.va / t) * 100) : 50;
    return `${p.text}\n\n${p.oa} or ${p.ob}? ${nf(t)} strangers have voted — ${pa}% say ${p.oa}.\n\nVote on AnonVerdict:`;
  }
  return `"${p.text}"\n\nRead more confessions on AnonVerdict:`;
}

export const CUR_LIST = Object.values(CUR);
