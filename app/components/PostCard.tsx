"use client";
import { useState } from "react";
import { CHIPS, ago, isFresh, nf, rsum, tvars, vsum, bgCss, bgSize, bgPos, TC, C } from "@/lib/board-helpers";
import type { Post } from "@/lib/types";

const VISIBLE_CHIPS = 4;

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
  reported = false,
  boosted = false,
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
  reported?: boolean;
  boosted?: boolean;
}) {
  const catKey = (post.category || "").toLowerCase();
  const acc = (C[catKey] || TC[post.type] || TC.confession).a;
  const bgv =
    post.bg && post.bg !== "plain"
      ? { backgroundImage: bgCss(post.bg, acc), backgroundSize: bgSize(post.bg), backgroundPosition: bgPos(post.bg) }
      : {};
  const style = { ...tvars(post), ...bgv };
  const t = vsum(post);
  const pa = t ? Math.round((post.va / t) * 100) : 50;
  const pb = 100 - pa;
  const [showAllChips, setShowAllChips] = useState(false);

  return (
    <article className={"card" + (post.type === "confession" ? " conf" : "") + (boosted ? " glow" : "")} style={style}>
      <div className="rank">{rank ? "#" + rank : ""}</div>
      <div className="body">
        <div className="meta">
          <span className="cat">
            <span className="cdot" />
            {post.category}
          </span>
          {isFresh(post) && <span className="tag fresh">Just posted</span>}
          {boosted && <span className="tag">Boosted</span>}
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
                title={votedSide ? `${pa}% voted for ${post.oa}` : `Vote for ${post.oa}`}
              >
                {votedSide ? pa + "%" + (votedSide === "a" ? " · yours" : "") : ""}
              </button>
              <button
                className="sd b"
                style={{ flexBasis: (votedSide ? pb : 50) + "%" }}
                disabled={!!votedSide}
                onClick={() => onVote("b")}
                title={votedSide ? `${pb}% voted for ${post.ob}` : `Vote for ${post.ob}`}
              >
                {votedSide ? (votedSide === "b" ? "yours · " : "") + pb + "%" : ""}
              </button>
              {!votedSide && <span className="bhint">Pick a side to see what everyone else said</span>}
            </div>

            {votedSide && (
              <div className="voted-summary-row">
                <span className="voted-summary-text">
                  {votedSide === "a" && pa >= 50
                    ? `${pa}% of the crowd voted with you`
                    : votedSide === "b" && pb >= 50
                    ? `${pb}% of the crowd voted with you`
                    : `You voted with the ${votedSide === "a" ? pa : pb}% underdog`}
                </span>
                <button
                  type="button"
                  className="share-inline-pill"
                  onClick={(e) => {
                    e.stopPropagation();
                    onShare();
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <circle cx="18" cy="5" r="3" />
                    <circle cx="6" cy="12" r="3" />
                    <circle cx="18" cy="19" r="3" />
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                  </svg>
                  Share result
                </button>
              </div>
            )}

            <div className="tally">{nf(t)} votes</div>
          </div>
        )}

        <div className="rx">
          {(showAllChips ? CHIPS : CHIPS.slice(0, VISIBLE_CHIPS)).map(([key, emoji, label]) => {
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
          {!showAllChips && CHIPS.length > VISIBLE_CHIPS && (
            <button type="button" className="chip more" onClick={() => setShowAllChips(true)}>
              +{CHIPS.length - VISIBLE_CHIPS} more
            </button>
          )}
        </div>

        <div className="foot">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12.5px', color: 'var(--faint)', marginRight: '8px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            {nf(vsum(post) + rsum(post))} views
          </span>
          <button className="lnk share-card-lnk" onClick={onShare}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ marginRight: 5 }}>
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            Share card
          </button>
          <span className="sp" />
          <button
            className={"lnk rep" + (reported ? " on" : "")}
            onClick={onReport}
            disabled={reported}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 5 }}>
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
              <line x1="4" y1="22" x2="4" y2="15"/>
            </svg>
            {reported ? "Reported" : "Report"}
          </button>
        </div>
      </div>
    </article>
  );
}
