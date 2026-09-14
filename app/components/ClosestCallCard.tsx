"use client";
import React, { useState } from "react";
import type { Post } from "@/lib/types";
import { vsum } from "@/lib/board-helpers";

interface ClosestCallCardProps {
  post?: Post | null;
  slideIndex?: number;
  totalSlides?: number;
  onVote?: (id: string, side: "a" | "b") => Promise<{ va: number; vb: number }>;
  votedSide?: "a" | "b";
  onShare: (postData: {
    id: string;
    category: string;
    story: string;
    optionA: string;
    optionB: string;
    pctA: number;
    votes: number;
    outcome?: string;
  }) => void;
  onOpen?: (id: string) => void;
}

const DEFAULT_SPLIT_POST = {
  id: "hero-split-ex-friend",
  category: "RELATIONSHIPS",
  headline: "Is it wrong to still talk to my ex as a friend?",
  story:
    "We ended on good terms, but we still text occasionally. My current partner is uncomfortable with it. Am I wrong for keeping the friendship?",
  oa: "Keep talking",
  ob: "Cut all contact",
  va: 56,
  vb: 44,
};

export default function ClosestCallCard({
  post,
  slideIndex,
  totalSlides,
  onVote,
  votedSide: initialVotedSide,
  onShare,
  onOpen,
}: ClosestCallCardProps) {
  const isDefault = !post || post.type !== "dilemma" || vsum(post) === 0;

  const id = isDefault ? DEFAULT_SPLIT_POST.id : post.id;
  const category = isDefault ? DEFAULT_SPLIT_POST.category : post.category;
  const headline = isDefault ? DEFAULT_SPLIT_POST.headline : post.text;
  const desc = isDefault
    ? DEFAULT_SPLIT_POST.story
    : "Strangers are split almost down the middle on this decision. One vote could move the verdict.";
  const oa = isDefault ? DEFAULT_SPLIT_POST.oa : post.oa || "Option A";
  const ob = isDefault ? DEFAULT_SPLIT_POST.ob : post.ob || "Option B";
  const initialVa = isDefault ? DEFAULT_SPLIT_POST.va : post.va;
  const initialVb = isDefault ? DEFAULT_SPLIT_POST.vb : post.vb;
  const outcomeNote = !isDefault && post.outcome ? post.outcome.note || undefined : undefined;

  const [votedSide, setVotedSide] = useState<"a" | "b" | undefined>(initialVotedSide);
  const [showVoteOptions, setShowVoteOptions] = useState(false);
  const [votesA, setVotesA] = useState(initialVa);
  const [votesB, setVotesB] = useState(initialVb);

  React.useEffect(() => {
    setVotedSide(initialVotedSide);
    setVotesA(initialVa);
    setVotesB(initialVb);
    setShowVoteOptions(false);
  }, [id, initialVotedSide, initialVa, initialVb]);

  const totalVotes = votesA + votesB;
  const pctA = totalVotes > 0 ? Math.round((votesA / totalVotes) * 100) : 56;
  const pctB = totalVotes > 0 ? 100 - pctA : 44;

  async function handleCastVote(side: "a" | "b") {
    if (votedSide) return;
    setVotedSide(side);
    if (side === "a") setVotesA((v) => v + 1);
    else setVotesB((v) => v + 1);

    if (onVote && !isDefault && post?.id) {
      try {
        const res = await onVote(post.id, side);
        setVotesA(res.va);
        setVotesB(res.vb);
      } catch (e) {
        console.error("Vote failed:", e);
      }
    }
  }

  function handleShareClick() {
    onShare({
      id,
      category: (category || "DILEMMA").toUpperCase(),
      story: headline,
      optionA: oa,
      optionB: ob,
      pctA: Math.round(pctA),
      votes: totalVotes,
      outcome: outcomeNote,
    });
  }

  return (
    <section className="closest-call-card" aria-label="Trending dilemma of the day">
      {/* Background Decorative Waves and Dot Grids */}
      <div className="hero-card-background" aria-hidden="true">
        {/* Top-Left Dot Grid (6 cols x 3 rows) */}
        <svg className="dot-grid dot-grid-tl" width="70" height="32" viewBox="0 0 70 32" fill="none">
          <circle cx="5" cy="5" r="2" fill="#E7DDD7" />
          <circle cx="17" cy="5" r="2" fill="#E7DDD7" />
          <circle cx="29" cy="5" r="2" fill="#E7DDD7" />
          <circle cx="41" cy="5" r="2" fill="#E7DDD7" />
          <circle cx="53" cy="5" r="2" fill="#E7DDD7" />
          <circle cx="65" cy="5" r="2" fill="#E7DDD7" />

          <circle cx="5" cy="16" r="2" fill="#E7DDD7" />
          <circle cx="17" cy="16" r="2" fill="#E7DDD7" />
          <circle cx="29" cy="16" r="2" fill="#E7DDD7" />
          <circle cx="41" cy="16" r="2" fill="#E7DDD7" />
          <circle cx="53" cy="16" r="2" fill="#E7DDD7" />
          <circle cx="65" cy="16" r="2" fill="#E7DDD7" />

          <circle cx="5" cy="27" r="2" fill="#E7DDD7" />
          <circle cx="17" cy="27" r="2" fill="#E7DDD7" />
          <circle cx="29" cy="27" r="2" fill="#E7DDD7" />
          <circle cx="41" cy="27" r="2" fill="#E7DDD7" />
          <circle cx="53" cy="27" r="2" fill="#E7DDD7" />
          <circle cx="65" cy="27" r="2" fill="#E7DDD7" />
        </svg>

        {/* Bottom-Right Dot Grid (6 cols x 3 rows) */}
        <svg className="dot-grid dot-grid-br" width="70" height="32" viewBox="0 0 70 32" fill="none">
          <circle cx="5" cy="5" r="2" fill="#E7DDD7" />
          <circle cx="17" cy="5" r="2" fill="#E7DDD7" />
          <circle cx="29" cy="5" r="2" fill="#E7DDD7" />
          <circle cx="41" cy="5" r="2" fill="#E7DDD7" />
          <circle cx="53" cy="5" r="2" fill="#E7DDD7" />
          <circle cx="65" cy="5" r="2" fill="#E7DDD7" />

          <circle cx="5" cy="16" r="2" fill="#E7DDD7" />
          <circle cx="17" cy="16" r="2" fill="#E7DDD7" />
          <circle cx="29" cy="16" r="2" fill="#E7DDD7" />
          <circle cx="41" cy="16" r="2" fill="#E7DDD7" />
          <circle cx="53" cy="16" r="2" fill="#E7DDD7" />
          <circle cx="65" cy="16" r="2" fill="#E7DDD7" />

          <circle cx="5" cy="27" r="2" fill="#E7DDD7" />
          <circle cx="17" cy="27" r="2" fill="#E7DDD7" />
          <circle cx="29" cy="27" r="2" fill="#E7DDD7" />
          <circle cx="41" cy="27" r="2" fill="#E7DDD7" />
          <circle cx="53" cy="27" r="2" fill="#E7DDD7" />
          <circle cx="65" cy="27" r="2" fill="#E7DDD7" />
        </svg>

        {/* Left Fluid Organic Wave in Soft Blush Pink */}
        <svg className="hero-wave-left" viewBox="0 0 320 320" fill="none" preserveAspectRatio="none">
          <path
            d="M-40 0 C 80 40, 160 160, 80 260 C 40 310, -20 340, -40 340 Z"
            fill="rgba(253, 232, 232, 0.55)"
          />
          <path
            d="M-40 80 C 60 120, 110 200, 50 300 C 20 330, -30 350, -40 350 Z"
            fill="rgba(254, 226, 226, 0.4)"
          />
        </svg>

        {/* Subtle Sweeping Arc over Gauge */}
        <svg className="hero-arc-top" viewBox="0 0 600 200" fill="none">
          <path
            d="M 10 180 Q 240 20 580 140"
            stroke="rgba(244, 114, 182, 0.16)"
            strokeWidth="1.8"
          />
        </svg>
      </div>

      {/* Left Angled Script Slogan: "Real Dilemmas. Real People. Your Verdict." */}
      <aside className="hero-script-slogan" aria-hidden="true">
        <div className="script-lines">
          <span className="script-word">Real</span>
          <span className="script-word">Dilemmas.</span>
          <span className="script-word">Real People.</span>
          <span className="script-word script-verdict">Your Verdict.</span>
        </div>
        <svg className="script-swoop-svg" viewBox="0 0 100 12" fill="none">
          <path
            d="M 4 8 C 32 13, 68 13, 96 4"
            stroke="#B58D89"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        </svg>
      </aside>

      {/* Left/Center Content Column */}
      <div className="closest-call-content">
        <div className="closest-call-badge-row">
          <span className="hero-trending-pill">
            <span className="hero-fire-icon" aria-hidden="true">🔥</span>
            TRENDING DILEMMA · {slideIndex || 1} OF {totalSlides || 6}
          </span>
          {category && (
            <span className="hero-category-tag">{category.toUpperCase()}</span>
          )}
        </div>

        <h2
          className="closest-call-headline"
          onClick={() => onOpen?.(id)}
          style={{ cursor: onOpen ? "pointer" : undefined }}
        >
          {headline}
        </h2>

        <p className="closest-call-desc">{desc}</p>

        {/* Voting Options & Main Actions */}
        {!showVoteOptions && !votedSide ? (
          <div className="closest-call-actions">
            <button
              type="button"
              className="btn-cast-vote"
              onClick={() => setShowVoteOptions(true)}
            >
              Cast your vote →
            </button>
            <button
              type="button"
              className="btn-read-story"
              onClick={() => onOpen?.(id)}
            >
              Read the full story
            </button>
            <button
              type="button"
              className="btn-share-hero"
              onClick={handleShareClick}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              Share dilemma
            </button>
          </div>
        ) : !votedSide && showVoteOptions ? (
          <div className="closest-call-vote-box">
            <span className="closest-call-pick-hint">Pick a side to cast your verdict:</span>
            <div className="closest-call-choice-grid">
              <button
                type="button"
                className="choice-btn choice-a"
                onClick={() => handleCastVote("a")}
              >
                <span className="choice-letter">A</span>
                <span>{oa}</span>
              </button>
              <button
                type="button"
                className="choice-btn choice-b"
                onClick={() => handleCastVote("b")}
              >
                <span className="choice-letter">B</span>
                <span>{ob}</span>
              </button>
            </div>
            <div style={{ marginTop: "10px", display: "flex", gap: "16px", alignItems: "center" }}>
              <button
                type="button"
                onClick={() => setShowVoteOptions(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--faint)",
                  fontSize: "13px",
                  cursor: "pointer",
                  textDecoration: "underline",
                  padding: "4px 0",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => onOpen?.(id)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--faint)",
                  fontSize: "13px",
                  cursor: "pointer",
                  textDecoration: "underline",
                  padding: "4px 0",
                }}
              >
                Read full story first →
              </button>
            </div>
          </div>
        ) : (
          <div className="closest-call-revealed">
            <div className="revealed-badge">
              {votedSide === "a" && pctA >= 50
                ? "You voted with the majority"
                : votedSide === "b" && pctB >= 50
                ? "You voted with the majority"
                : "You voted with the underdog"}
            </div>
            <div className="revealed-bars">
              <div className="revealed-bar-row">
                <span>{oa}</span>
                <strong>{pctA}% {votedSide === "a" ? "· yours" : ""}</strong>
              </div>
              <div className="bar-track">
                <div className="bar-fill-a" style={{ width: `${pctA}%`, background: "#FB7185" }} />
                <div className="bar-fill-b" style={{ width: `${pctB}%`, background: "#6B8E7B" }} />
              </div>
              <div className="revealed-bar-row">
                <span>{ob}</span>
                <strong>{pctB}% {votedSide === "b" ? "· yours" : ""}</strong>
              </div>
            </div>
            <div className="revealed-actions" style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button type="button" className="btn-cast-vote" onClick={handleShareClick}>
                Share where I landed
              </button>
              <button type="button" className="btn-read-story" onClick={() => onOpen?.(id)}>
                View full post & reactions →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right Column: Donut Gauge + Summary Option Pills */}
      <div className="closest-call-gauge-wrap">
        <div
          className="donut-gauge hero-donut"
          style={{
            background: `conic-gradient(from 180deg, #FB7185 0% ${pctA}%, #6B8E7B ${pctA}% 100%)`,
          }}
          role="img"
          aria-label={`${pctA} percent versus ${pctB} percent`}
        >
          <div className="donut-hole">
            <div className="donut-value">
              {pctA} / {pctB}
            </div>
            <div className="donut-label">THE INTERNET IS SPLIT</div>
          </div>
        </div>

        {/* Choice Pills below donut */}
        <div className="hero-option-pills">
          <button
            type="button"
            className={`hero-pill-row pill-row-a ${votedSide === "a" ? "active-voted" : ""}`}
            onClick={() => handleCastVote("a")}
            disabled={!!votedSide}
            title={`Vote: ${oa}`}
          >
            <div className="pill-row-left">
              <span className="pill-icon-wrap pill-heart-icon" aria-hidden="true">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="#E11D48" stroke="#E11D48" strokeWidth="1">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </span>
              <span className="pill-label-text">{oa}</span>
            </div>
            <span className="pill-pct-bold">{pctA}%</span>
          </button>

          <button
            type="button"
            className={`hero-pill-row pill-row-b ${votedSide === "b" ? "active-voted" : ""}`}
            onClick={() => handleCastVote("b")}
            disabled={!!votedSide}
            title={`Vote: ${ob}`}
          >
            <div className="pill-row-left">
              <span className="pill-icon-wrap pill-cross-icon" aria-hidden="true">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#233E31" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </span>
              <span className="pill-label-text">{ob}</span>
            </div>
            <span className="pill-pct-bold">{pctB}%</span>
          </button>
        </div>

        {/* Thousands of Real Opinions */}
        <div className="hero-opinions-subline">
          THOUSANDS OF REAL OPINIONS
        </div>
      </div>
    </section>
  );
}
