"use client";
import { eng, nf, rupee, vsum } from "@/lib/board-helpers";
import type { Post } from "@/lib/types";
import type { CurrencyCode } from "@/lib/currency";

// SLOTS is 1, so this card is always "the" pinned post — there is no ranked
// #2/#3 state to render. (There used to be, for a 5-slot shelf; keeping that
// dead branch around was exactly what caused the pricing copy to drift from
// what the shelf actually does — see the audit.)
export function PinCard({ post, currency, onOpen }: { post: Post; currency: CurrencyCode; onOpen: () => void }) {
  const t = vsum(post);
  const statLabel = post.type === "dilemma" ? `${nf(t)} votes` : `${nf(eng(post))} reactions`;

  return (
    <button className={"pcard top" + (post.type === "confession" ? " conf" : "")} onClick={onOpen}>
      <div className="ptop">
        <span className="pnum">🏆 Top pinned post</span>
        <span className="pcat">
          <span className="pcatdot" />
          {post.category} · held at {rupee(post.paid || 0, currency)}
        </span>
      </div>
      <span className="ptxt">{post.type === "confession" ? `“${post.text}”` : post.text}</span>
      <span className="pfoot">
        <span>{statLabel}</span>
        <span className="open">Open the pinned post →</span>
      </span>
    </button>
  );
}

export function EmptySlot({ price, currency, onClick }: { price: number; currency: CurrencyCode; onClick: () => void }) {
  return (
    <button className="slot-empty" onClick={onClick} aria-label="Pinned slot open">
      <b>The pinned spot is open</b>
      <span>Be the first to claim it — from {rupee(price, currency)} for 24 hours</span>
    </button>
  );
}
