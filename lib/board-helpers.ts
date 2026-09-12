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
  ["trending", "Trending"], ["new", "Just posted"], ["needy", "Needs your votes"],
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
export const isFresh = (p: Post) => Date.now() - p.at < 2 * H;
export const needsVotes = (votedIds: Set<string>) => (p: Post) =>
  !votedIds.has(p.id) && (p.type === "dilemma" ? vsum(p) < 400 : eng(p) < 40);

export const SLOTS = 5;

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
  const x = TC[p.type] || TC.confession;
  return { "--acc": x.a, "--tint": x.t, "--deep": x.d } as React.CSSProperties;
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
    return `${p.text}\n\n${p.oa} or ${p.ob}? ${nf(t)} strangers have voted — ${pa}% say ${p.oa}.\n\nVote on The Unsaid:`;
  }
  return `"${p.text}"\n\nRead more confessions on The Unsaid:`;
}

export const CUR_LIST = Object.values(CUR);
