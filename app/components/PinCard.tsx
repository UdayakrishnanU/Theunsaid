"use client";
import { cc, eng, nf, rupee, vsum } from "@/lib/board-helpers";
import type { Post } from "@/lib/types";
import type { CurrencyCode } from "@/lib/currency";

export function PinCard({ post, index, currency, onOpen }: { post: Post; index: number; currency: CurrencyCode; onOpen: () => void }) {
  const t = vsum(post);
  const isTop = index === 0;
  const c = cc(post.category);
  const style = isTop
    ? undefined
    : ({ "--pacc": c.a, "--ptint": c.t, "--pdeep": c.d } as React.CSSProperties);
  const statLabel = post.type === "dilemma" ? `${nf(t)} votes` : `${nf(eng(post))} reactions`;

  return (
    <button className={"pcard" + (post.type === "confession" ? " conf" : "") + (isTop ? " top" : "")} style={style} onClick={onOpen}>
      <div className="ptop">
        <span className="pnum">{isTop ? "🏆 Top pinned post" : "#" + (index + 1)}</span>
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

export function EmptySlot({ n, price, currency, onClick }: { n: number; price: number; currency: CurrencyCode; onClick: () => void }) {
  return (
    <button className="slot-empty" onClick={onClick} aria-label={`Pinned slot ${n} open`}>
      <b>The pinned spot is open</b>
      <span>Be the first to claim it — from {rupee(price, currency)} for 24 hours</span>
    </button>
  );
}
