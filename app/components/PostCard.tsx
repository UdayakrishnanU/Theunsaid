"use client";
import { useState, useRef, useEffect } from "react";
import {
  CHIPS,
  ago,
  isFresh,
  nf,
  rsum,
  vsum,
  splitHeadline,
  BOOSTED_SHADES,
  CAT_META,
  formatScore,
  calcViews,
} from "@/lib/board-helpers";
import type { Post } from "@/lib/types";

const VISIBLE_CHIPS = 4;

export default function PostCard({
  post,
  rank,
  votedSide,
  reactedKeys = [],
  onOpen,
  onVote,
  onReact,
  onShare,
  onReport,
  reported = false,
  boosted = false,
  pinned = false,
}: {
  post: Post;
  rank?: number | null;
  votedSide?: "a" | "b";
  reactedKeys?: string[];
  onOpen: () => void;
  onVote: (side: "a" | "b") => void;
  onReact: (key: string) => void;
  onShare: () => void;
  onReport: () => void;
  reported?: boolean;
  boosted?: boolean;
  pinned?: boolean;
}) {
  const isPinned = pinned || post.tier === "pin";
  const isBoosted = !isPinned && (boosted || post.tier === "glow");

  // Determine boosted shade if applicable
  const shade = isBoosted ? BOOSTED_SHADES[post.bg || "rose"] || BOOSTED_SHADES.rose : null;

  const catKey = (post.category || "random").toLowerCase();
  const catMeta = CAT_META[catKey] || {
    label: post.category || "Random",
    icon: "💬",
    bg: "#F1F5F9",
    border: "#E2E8F0",
    text: "#334155",
  };

  const { headline, rest } = splitHeadline(post.text);
  const totalVotes = vsum(post);
  const totalReacts = rsum(post);
  const displayScore = totalVotes > 0 ? totalVotes : Math.max(1, totalReacts);

  const pa = totalVotes ? Math.round((post.va / totalVotes) * 100) : 50;
  const pb = 100 - pa;

  const [localVote, setLocalVote] = useState<"up" | "down" | null>(null);
  const [showAllChips, setShowAllChips] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showMenu]);

  function handleUpvote() {
    if (votedSide) return;
    setLocalVote("up");
    if (post.type === "dilemma") {
      onVote("a");
    } else {
      onReact("nailed");
    }
  }

  function handleDownvote() {
    if (votedSide) return;
    setLocalVote("down");
    if (post.type === "dilemma") {
      onVote("b");
    } else {
      onReact("thought");
    }
  }

  function handleCopyPostLink(e: React.MouseEvent) {
    e.stopPropagation();
    const url = `${window.location.origin}/#p=${post.id}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopiedLink(true);
    setTimeout(() => {
      setCopiedLink(false);
      setShowMenu(false);
    }, 1200);
  }

  // Visual card styles
  let cardClass = "feed-post-card";
  let cardStyle: React.CSSProperties = {};

  if (isPinned) {
    cardClass += " card-pinned";
  } else if (isBoosted && shade) {
    cardClass += " card-boosted";
    cardStyle = {
      background: shade.bgGradient,
      borderColor: shade.border,
      boxShadow: shade.glowShadow,
    };
  }

  return (
    <article className={cardClass} style={cardStyle}>
      {/* Left Vote Score Column */}
      <div className="post-vote-col">
        <button
          type="button"
          className={"vote-btn up-btn" + (votedSide === "a" || localVote === "up" ? " active" : "")}
          onClick={handleUpvote}
          aria-label="Upvote"
          title={post.type === "dilemma" ? `Vote for ${post.oa || "Option A"}` : "Upvote"}
          style={{
            color:
              votedSide === "a" || localVote === "up"
                ? isBoosted
                  ? shade?.accent
                  : isPinned
                  ? "#D97706"
                  : "#0F172A"
                : undefined,
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>

        <span
          className="post-score-num"
          style={{
            color: isBoosted
              ? shade?.accent || "#E11D48"
              : isPinned
              ? "#1E293B"
              : "#0F172A",
          }}
        >
          {formatScore(displayScore)}
        </span>

        <button
          type="button"
          className={"vote-btn down-btn" + (votedSide === "b" || localVote === "down" ? " active" : "")}
          onClick={handleDownvote}
          aria-label="Downvote"
          title={post.type === "dilemma" ? `Vote for ${post.ob || "Option B"}` : "Downvote"}
          style={{
            color:
              votedSide === "b" || localVote === "down"
                ? isBoosted
                  ? shade?.accent
                  : isPinned
                  ? "#D97706"
                  : "#0F172A"
                : undefined,
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {/* Main Content Column */}
      <div className="post-main-col">
        {/* Header Row */}
        <div className="post-header-row">
          <div className="post-header-left">
            {/* Anonymous avatar pill */}
            <div className="post-anon-pill">
              <span className="post-anon-avatar" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" fill="#334155" />
                  <circle cx="9" cy="11" r="2" fill="#FFFFFF" />
                  <circle cx="15" cy="11" r="2" fill="#FFFFFF" />
                  <path d="M7 10h10M6 13a3 3 0 006 0 3 3 0 006 0" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </span>
              <span className="post-anon-label">Anonymous</span>
            </div>

            <span className="post-meta-dot">•</span>
            <span className="post-time-ago">{ago(post.at)}</span>
          </div>

          <div className="post-header-right">
            {/* Pinned Badge */}
            {isPinned && (
              <span className="post-badge-pinned">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2 4l3 12h14l3-12-5 6-5-6-5 6-5-6z" />
                </svg>
                Pinned
              </span>
            )}

            {/* Boosted Badge */}
            {isBoosted && (
              <span
                className="post-badge-boosted"
                style={{
                  background: shade?.badgeBg || "linear-gradient(135deg, #FF2E7E, #F43F5E)",
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                Boosted
              </span>
            )}

            {/* Category Pill */}
            <span
              className="post-cat-pill"
              style={{
                background: catMeta.bg,
                borderColor: catMeta.border,
                color: catMeta.text,
              }}
            >
              <span className="cat-icon">{catMeta.icon}</span>
              <span>{catMeta.label}</span>
            </span>

            {/* Three Dots Menu */}
            <div className="post-menu-wrap" ref={menuRef}>
              <button
                type="button"
                className="post-menu-btn"
                aria-label="More options"
                onClick={() => setShowMenu((prev) => !prev)}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="12" r="2.2" />
                  <circle cx="5" cy="12" r="2.2" />
                  <circle cx="19" cy="12" r="2.2" />
                </svg>
              </button>

              {showMenu && (
                <div className="post-menu-dropdown">
                  <button type="button" onClick={handleCopyPostLink} className="menu-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    {copiedLink ? "Link copied!" : "Copy link"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      onShare();
                    }}
                    className="menu-item"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="18" cy="5" r="3" />
                      <circle cx="6" cy="12" r="3" />
                      <circle cx="18" cy="19" r="3" />
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                    </svg>
                    Share card
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      onReport();
                    }}
                    disabled={reported}
                    className={"menu-item menu-report" + (reported ? " reported" : "")}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                      <line x1="4" y1="22" x2="4" y2="15" />
                    </svg>
                    {reported ? "Reported" : "Report post"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Question / Title Content Row with Artwork */}
        <div className="post-middle-row">
          <div className="post-body-content">
            <h2 className="post-headline" onClick={onOpen}>
              {headline}
              {rest && <span className="post-headline-rest"> {rest}</span>}
            </h2>

            {/* Dilemma voting bar */}
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
              </div>
            )}

            {/* Reaction Chips */}
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
          </div>

          {/* Right-Side Decorative Artwork (Boosted & Pinned) */}
          {isBoosted && (
            <div className="post-art-wrap boosted-art" aria-hidden="true">
              <div className="post-art-visual">
                <svg className="art-bolt-svg" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M13 2L3 14H12L11 22L21 10H12L13 2Z"
                    fill={shade?.accent || "#F43F5E"}
                    fillOpacity="0.25"
                    stroke={shade?.accent || "#F43F5E"}
                    strokeWidth="1.2"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div className="post-art-typography">
                <span className="art-script-line" style={{ color: shade?.textDark || "#BE123C" }}>
                  More voices.
                </span>
                <span className="art-script-line" style={{ color: shade?.textDark || "#BE123C" }}>
                  More perspectives.
                </span>
                <svg className="art-swoosh-svg" viewBox="0 0 64 8" fill="none">
                  <path d="M1 5C16 7.5 38 1 63 4" stroke={shade?.accent || "#F43F5E"} strokeWidth="2.2" strokeLinecap="round" />
                </svg>
              </div>
            </div>
          )}

          {isPinned && (
            <div className="post-art-wrap pinned-art" aria-hidden="true">
              <div className="post-art-visual">
                <svg className="art-crown-svg" viewBox="0 0 32 32" fill="none">
                  <defs>
                    <linearGradient id="goldCrownGradCard" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#FDE68A" />
                      <stop offset="45%" stopColor="#F59E0B" />
                      <stop offset="100%" stopColor="#B45309" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M4 9L9 23H23L28 9L20 16L16 7L12 16L4 9Z"
                    fill="url(#goldCrownGradCard)"
                    stroke="#B45309"
                    strokeWidth="1.4"
                    strokeLinejoin="round"
                  />
                  <circle cx="4" cy="9" r="2.2" fill="#FEF3C7" stroke="#B45309" strokeWidth="0.8" />
                  <circle cx="16" cy="7" r="2.4" fill="#FEF3C7" stroke="#B45309" strokeWidth="0.8" />
                  <circle cx="28" cy="9" r="2.2" fill="#FEF3C7" stroke="#B45309" strokeWidth="0.8" />
                </svg>
              </div>
              <div className="post-art-typography">
                <span className="art-script-line" style={{ color: "#78350F" }}>
                  Top of the feed.
                </span>
                <span className="art-script-line" style={{ color: "#78350F" }}>
                  Bigger conversations.
                </span>
                <svg className="art-swoosh-svg" viewBox="0 0 64 8" fill="none">
                  <path d="M1 5C16 7.5 38 1 63 4" stroke="#D97706" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* Footer Stats & Share Row */}
        <div className="post-footer-row">
          <div className="post-stats-group">
            {/* Votes stat */}
            <span className="post-stat-item">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
              <span className="stat-text">{formatScore(totalVotes || displayScore)} votes</span>
            </span>

            {/* Comments / responses stat */}
            <span className="post-stat-item">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span className="stat-text">{formatScore(totalReacts || Math.round(displayScore * 0.45))} comments</span>
            </span>

            {/* Views stat */}
            <span className="post-stat-item">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span className="stat-text">{calcViews(post)} views</span>
            </span>
          </div>

          <div className="post-footer-actions">
            <button
              type="button"
              className={
                "post-share-btn" +
                (isPinned ? " share-pinned" : isBoosted ? " share-boosted" : "")
              }
              onClick={onShare}
              style={
                isBoosted && shade
                  ? {
                      background: shade.bgLight,
                      borderColor: shade.border,
                      color: shade.textDark,
                    }
                  : undefined
              }
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              <span>Share</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
