import type { PostType } from "@/lib/types";
import type { Tier } from "@/lib/currency";
import { generateTarget } from "./engagementTarget";

const DRIP_WINDOW_EFFECTIVE_HOURS = 8;

// IST hour -> traffic weight. Growth is measured in "effective hours", not
// wall-clock hours, so a post from 3am visibly grows slower than one from
// 6pm -- matching real traffic instead of a cron tick that doesn't know
// what time it is.
function trafficWeight(istHour: number): number {
  if (istHour >= 2 && istHour < 7.5) return 0.15; // graveyard
  if (istHour >= 7.5 && istHour < 10) return 0.7; // morning ramp
  if (istHour >= 23.5 || istHour < 2) return 0.5; // late night
  return 1.0; // peak day
}

function istHourOf(ms: number): number {
  const ist = new Date(ms + 5.5 * 3600 * 1000);
  return ist.getUTCHours() + ist.getUTCMinutes() / 60;
}

// Sum of traffic-weighted hours between two timestamps. The drip window is
// at most ~10h so this walks it in 15-minute steps -- cheap per call.
function effectiveHoursBetween(startMs: number, endMs: number): number {
  if (endMs <= startMs) return 0;
  let total = 0;
  const stepMs = 15 * 60 * 1000;
  for (let t = startMs; t < endMs; t += stepMs) {
    total += (Math.min(stepMs, endMs - t) / 3600000) * trafficWeight(istHourOf(t));
  }
  return total;
}

// Deterministic per-(post, metric) jitter -- same inputs always produce the
// same speed, so a post's curve never visibly jumps between requests, and
// two same-tier same-age posts don't grow in lockstep with each other.
function jitter(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return 0.8 + ((h % 1000) / 1000) * 0.5; // 0.8x - 1.3x
}

function easeOut(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return 1 - (1 - c) * (1 - c);
}

function rampedValue(postId: string, metricKey: string, target: number, createdAtMs: number, nowMs: number): number {
  if (target <= 0) return 0;
  // Bucket "now" to the nearest 10 minutes so two requests a few seconds
  // apart return identical numbers -- stability, not a growth step.
  const bucketedNow = Math.floor(nowMs / (10 * 60 * 1000)) * 10 * 60 * 1000;
  const speed = jitter(postId + metricKey);
  const effHours = effectiveHoursBetween(createdAtMs, bucketedNow) * speed;
  return Math.round(target * easeOut(effHours / DRIP_WINDOW_EFFECTIVE_HOURS));
}

export interface DrippablePost {
  id: string;
  tier: Tier;
  type: PostType;
  at: number; // created_at, epoch ms
  va: number;
  vb: number;
  reactions: Record<string, number>;
}

/** Applies to every live post, seed or real, by design -- see the spec.
 * Read-only and additive-only: never returns less than what's actually
 * stored (a real vote always wins over the curve), never more than that
 * post's own generated target. Nothing is written back to the database;
 * this only changes what gets shown. Generic so it works on `Post` or any
 * post-shaped object with extra fields (those pass through unchanged via
 * the spread). */
export function applyEngagementDrip<T extends DrippablePost>(post: T): T {
  const target = generateTarget(post.id, post.tier, post.type);
  const now = Date.now();

  const va = Math.max(post.va, rampedValue(post.id, "va", target.va, post.at, now));
  const vb = Math.max(post.vb, rampedValue(post.id, "vb", target.vb, post.at, now));

  const reactions: Record<string, number> = { ...post.reactions };
  for (const [key, targetCount] of Object.entries(target.reactions)) {
    const ramped = rampedValue(post.id, `r:${key}`, targetCount, post.at, now);
    reactions[key] = Math.max(reactions[key] ?? 0, ramped);
  }

  return { ...post, va, vb, reactions };
}
