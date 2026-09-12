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

  return (
    <button className={"pcard" + (post.type === "confession" ? " conf" : "") + (isTop ? " top" : "")} style={style} onClick={onOpen}>
      <span className="pnum">{isTop ? "🏆" : "#" + (index + 1)}</span>
      <span className="pcat">
        <span className="pcatdot" />
        {post.category} · held at {rupee(post.paid || 0, currency)}
      </span>
      <span className="ptxt">{post.type === "confession" ? `“${post.text}”` : post.text}</span>
      <span className="pfoot">
        <span>{post.type === "dilemma" ? `${nf(t)} votes` : `${nf(eng(post))} reactions`}</span>
        <span className="open">Open</span>
      </span>
    </button>
  );
}

export function EmptySlot({ n, price, currency, onClick }: { n: number; price: number; currency: CurrencyCode; onClick: () => void }) {
  return (
    <button className="slot-empty" onClick={onClick}>
      <b>Slot {n}</b>
      <span>Open — claim it from {rupee(price, currency)}</span>
    </button>
  );
}
