"use client";
import { CHIPS, ago, isFresh, nf, rsum, tvars, vsum, bgCss, bgSize, bgPos, TC } from "@/lib/board-helpers";
import type { Post } from "@/lib/types";

export default function PostCard({
  post,
  rank,
  votedSide,
  reactedKeys,
  onOpen,
  onVote,
  onReact,
  onShare,
  onReport,
}: {
  post: Post;
  rank: number | null;
  votedSide?: "a" | "b";
  reactedKeys: string[];
  onOpen: () => void;
  onVote: (side: "a" | "b") => void;
  onReact: (key: string) => void;
  onShare: () => void;
  onReport: () => void;
}) {
  const acc = (TC[post.type] || TC.confession).a;
  const bgv =
    post.bg && post.bg !== "plain"
      ? { backgroundImage: bgCss(post.bg, acc), backgroundSize: bgSize(post.bg), backgroundPosition: bgPos(post.bg) }
      : {};
  const style = { ...tvars(post), ...bgv };
  const t = vsum(post);
  const pa = t ? Math.round((post.va / t) * 100) : 50;

  return (
    <article className={"card" + (post.type === "confession" ? " conf" : "")} style={style}>
      <div className="rank">{rank ? "#" + rank : ""}</div>
      <div className="body">
        <div className="meta">
          <span className="cat">
            <span className="cdot" />
            {post.category}
          </span>
          {isFresh(post) && <span className="tag fresh">Just posted</span>}
          <span className="sep">·</span>
          <span className="t">{ago(post.at)}</span>
          <span className="sep">·</span>
          <span className="t">{nf(rsum(post))} reactions</span>
          {post.type === "dilemma" && (
            <>
              <span className="sep">·</span>
              <span className="t">{nf(vsum(post))} votes</span>
            </>
          )}
        </div>
        <p className="txt" style={{ cursor: "pointer" }} onClick={onOpen}>
          {post.text}
        </p>
        {post.type === "dilemma" && (
          <div className="bar-wrap">
            <div className="blab">
              <span>{post.oa}</span>
              <span className="r">{post.ob}</span>
            </div>
            <div className={"bar" + (votedSide ? " done" : "")}>
              <button
                className="sd a"
                style={{ flexBasis: (votedSide ? pa : 50) + "%" }}
                disabled={!!votedSide}
                onClick={() => onVote("a")}
              >
                {votedSide ? pa + "%" + (votedSide === "a" ? " · yours" : "") : ""}
              </button>
              <button
                className="sd b"
                style={{ flexBasis: (votedSide ? 100 - pa : 50) + "%" }}
                disabled={!!votedSide}
                onClick={() => onVote("b")}
              >
                {votedSide ? (votedSide === "b" ? "yours · " : "") + (100 - pa) + "%" : ""}
              </button>
              {!votedSide && <span className="bhint">Pick a side to see what everyone else said</span>}
            </div>
            <div className="tally">{nf(t)} votes</div>
          </div>
        )}
        <div className="rx">
          {CHIPS.map(([key, emoji, label]) => {
            const count = post.reactions?.[key] || 0;
            const on = reactedKeys.includes(key);
            return (
              <button key={key} className={"chip" + (on ? " on" : "")} onClick={() => onReact(key)} aria-label={label}>
                <span aria-hidden="true">{emoji}</span>
                {label}
                {count > 0 && <span className="n">{nf(count)}</span>}
              </button>
            );
          })}
        </div>
        <div className="foot">
          <button className="lnk" onClick={onShare}>
            Share
          </button>
          <span className="sp" />
          <button className="lnk rep" onClick={onReport}>
            Report
          </button>
        </div>
      </div>
    </article>
  );
}
