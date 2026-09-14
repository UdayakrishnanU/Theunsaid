import type { PostType } from "@/lib/types";
import type { Tier } from "@/lib/currency";
import { CHIPS } from "@/lib/board-helpers";

export interface EngagementTarget {
  va: number;
  vb: number;
  reactions: Record<string, number>;
}

// Reaction counts are a % of that post's own vote total (not a flat number)
// so they stay proportionate no matter what the vote range is -- see
// engagementDrip.ts for how this gets ramped in over time.
const RANGES: Record<Tier, { votes: [number, number]; nReact: [number, number]; reactPctOfVotes: [number, number] }> = {
  pin: { votes: [310, 450], nReact: [3, 6], reactPctOfVotes: [0.05, 0.3] },
  glow: { votes: [130, 200], nReact: [2, 5], reactPctOfVotes: [0.04, 0.25] },
  std: { votes: [70, 150], nReact: [1, 4], reactPctOfVotes: [0.03, 0.2] },
};

// Deterministic PRNG seeded from the post's own id -- the same post always
// yields the same target, forever, with no lookup table and no DB write.
function hashSeed(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let s = seed;
  return function rand(): number {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Every post's own permanent, randomly-chosen "should eventually look like
 * this many votes/reactions" ceiling. Purely a function of (id, tier, type)
 * -- nothing is stored, nothing is looked up, and the same post computes the
 * exact same target on every call, forever. */
export function generateTarget(postId: string, tier: Tier, type: PostType): EngagementTarget {
  const rand = mulberry32(hashSeed(postId + "|target"));
  const r = RANGES[tier];
  const totalVotes = Math.round(r.votes[0] + rand() * (r.votes[1] - r.votes[0]));

  let va = 0;
  let vb = 0;
  if (type === "dilemma") {
    const split = 0.25 + rand() * 0.5; // 25-75%, matches the seed generator's spread
    va = Math.round(totalVotes * split);
    vb = totalVotes - va;
  } // confessions have no options to vote on -- va/vb stay 0

  const nReactions = Math.round(r.nReact[0] + rand() * (r.nReact[1] - r.nReact[0]));
  const keys = CHIPS.map(([k]) => k);
  for (let i = keys.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [keys[i], keys[j]] = [keys[j], keys[i]];
  }
  const reactions: Record<string, number> = {};
  for (let i = 0; i < nReactions; i++) {
    const pct = r.reactPctOfVotes[0] + rand() * (r.reactPctOfVotes[1] - r.reactPctOfVotes[0]);
    reactions[keys[i]] = Math.max(1, Math.round(totalVotes * pct)); // proportional to THIS post's own votes
  }

  return { va, vb, reactions };
}
