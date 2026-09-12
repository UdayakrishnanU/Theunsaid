import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Rate limiting per the prep doc's Phase 2 item ("stops one person flooding the
// board"). Backed by Upstash Redis when configured; degrades to an in-memory
// limiter (per server instance — fine for a single Vercel region on low
// traffic, not a substitute for Upstash once you have real volume) so the app
// still works before you've created that account.
let limiter: Ratelimit | null = null;
function getUpstashLimiter(points: number, windowSeconds: number): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  if (!limiter) {
    limiter = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(points, `${windowSeconds} s`),
      analytics: false,
    });
  }
  return limiter;
}

const memBuckets = new Map<string, { count: number; resetAt: number }>();
function memoryLimit(key: string, points: number, windowSeconds: number): { success: boolean } {
  const now = Date.now();
  const b = memBuckets.get(key);
  if (!b || b.resetAt < now) {
    memBuckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { success: true };
  }
  b.count++;
  return { success: b.count <= points };
}

/** identifier: usually an IP address or `${ip}:${action}`. */
export async function rateLimit(identifier: string, points = 20, windowSeconds = 60): Promise<{ success: boolean }> {
  const up = getUpstashLimiter(points, windowSeconds);
  if (up) {
    const r = await up.limit(identifier);
    return { success: r.success };
  }
  return memoryLimit(`${identifier}:${points}:${windowSeconds}`, points, windowSeconds);
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "0.0.0.0";
}
