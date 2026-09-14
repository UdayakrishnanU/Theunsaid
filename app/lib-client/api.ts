"use client";
import type { Post } from "@/lib/types";
import type { CurrencyCode, Tier } from "@/lib/currency";

async function j<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  return data as T;
}

export const api = {
  listPosts: () => fetch("/api/posts", { cache: "no-store" }).then((r) => j<{ posts: Post[] }>(r)),

  createPost: (body: {
    type: "confession" | "dilemma";
    category: string;
    text: string;
    optionA?: string;
    optionB?: string;
    bg: string;
    tier: Tier;
    currency: CurrencyCode;
    bidAmount?: number;
    ownerKey?: string;
    turnstileToken?: string;
    idempotencyKey?: string;
  }) =>
    fetch("/api/posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) =>
      j<{
        postId: string;
        ownerKey: string;
        order: { id: string; amount: number; currency: string };
        cashfree?: { paymentSessionId: string; mode: "sandbox" | "production" };
        careFlag?: boolean;
      }>(r)
    ),

  vote: (id: string, side: "a" | "b") =>
    fetch(`/api/posts/${id}/vote`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ side }) }).then((r) =>
      j<{ va: number; vb: number; alreadyVoted: boolean }>(r)
    ),

  react: (id: string, key: string) =>
    fetch(`/api/posts/${id}/react`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) }).then((r) =>
      j<{ reactions: Record<string, number> }>(r)
    ),

  report: (id: string) => fetch(`/api/posts/${id}/report`, { method: "POST" }).then((r) => j<{ reports: number; hidden: boolean }>(r)),

  outcome: (id: string, body: { ownerKey: string; choice: "a" | "b" | "other"; note?: string | null }) =>
    fetch(`/api/posts/${id}/outcome`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => j<{ ok: true }>(r)),

  deletePost: (id: string, ownerKey: string) =>
    fetch(`/api/posts/${id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ownerKey }) }).then((r) => j<{ ok: true }>(r)),

  claim: (ownerKey: string) =>
    fetch("/api/claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ownerKey }) }).then((r) =>
      j<{ posts: (Post & { status: string })[] }>(r)
    ),

  presence: () => fetch("/api/presence", { method: "POST" }).then((r) => j<{ online: number; today: number }>(r)),

  // What it actually costs right now to get on (or beat) the pinned shelf —
  // computed server-side, same formula the POST /api/posts price check uses.
  pinFloor: (currency: CurrencyCode) =>
    fetch(`/api/posts/pin-floor?currency=${currency}`, { cache: "no-store" }).then((r) => j<{ floorBase: number; topBase: number }>(r)),

  // Instant payment confirmation — called right after checkout reports
  // success, so the post can go live without waiting on the webhook's own
  // delivery time. Verified server-to-server directly with Cashfree.
  confirmPayment: (postId: string, body: { orderId: string }) =>
    fetch(`/api/posts/${postId}/confirm`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) =>
      j<{ ok: true; status: string }>(r)
    ),

  // Opens a fresh Cashfree order for a post stuck as pending_payment, so a
  // stalled or abandoned checkout has a way back in besides deleting it.
  resumePayment: (postId: string, ownerKey: string) =>
    fetch(`/api/posts/${postId}/resume-payment`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ownerKey }) }).then(
      (r) =>
        j<{
          order: { id: string; amount: number; currency: string };
          cashfree?: { paymentSessionId: string; mode: "sandbox" | "production" };
        }>(r)
    ),
};
