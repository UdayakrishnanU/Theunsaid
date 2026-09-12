import type { CurrencyCode, Tier } from "./currency";

export type PostType = "confession" | "dilemma";
export type Category = "relationships" | "work" | "money" | "family" | "random";
export type PostStatus = "pending_payment" | "live" | "hidden" | "deleted";

export interface Outcome {
  choice: "a" | "b" | "other";
  note: string | null;
  at: number; // epoch ms
}

// Shape returned to the client by GET /api/posts — deliberately close to the
// original prototype's in-memory post object so the ported UI logic (rank,
// heat, needsVotes, etc, all pure functions of this shape) barely had to change.
export interface Post {
  id: string;
  type: PostType;
  category: Category;
  text: string;
  oa: string | null;
  ob: string | null;
  bg: string;
  tier: Tier;
  currency: CurrencyCode;
  paid: number | null; // paid_base, in the ranking unit from lib/currency.ts
  until: number | null; // epoch ms
  va: number;
  vb: number;
  reactions: Record<string, number>;
  reports: number;
  hidden: boolean;
  outcome: Outcome | null;
  at: number; // epoch ms, created_at
}
