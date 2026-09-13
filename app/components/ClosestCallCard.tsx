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
}

const DEFAULT_SPLIT_POST = {
  id: "hero-split-wedding",
  category: "WEDDINGS",
  headline: "Her sister invited the ex. The internet cannot agree.",
  story:
    "The bride says it is her guest list. Her sister says family loyalty should have come first. One vote is almost as likely to move the verdict as the next.",
  oa: "She crossed a boundary",
  ob: "It is her wedding",
  va: 812,
  vb: 790,
};

export default function ClosestCallCard({
  post,
  slideIndex,
  totalSlides,
  onVote,
  votedSide: initialVotedSide,
  onShare,
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
  const pctA = totalVotes > 0 ? Math.round((votesA / totalVotes) * 1000) / 10 : 50.7;
  const pctB = totalVotes > 0 ? Math.round((100 - pctA) * 10) / 10 : 49.3;

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
      category: category.toUpperCase(),
      story: headline,
      optionA: oa,
      optionB: ob,
      pctA: Math.round(pctA),
      votes: totalVotes,
      outcome: outcomeNote,
    });
  }

  return (
    <section className="closest-call-card" aria-label="Closest call of the day">
      <div className="closest-call-content">
        <div className="closest-call-badge-row">
          <span className="closest-call-pill">
            <span className="closest-call-pulse-dot" />
            CLOSEST CALL TODAY {totalSlides && totalSlides > 1 ? `· ${slideIndex} OF ${totalSlides}` : ""}
          </span>
          {category && (
            <span className="closest-call-cat-tag">{category.toUpperCase()}</span>
          )}
        </div>

        <h2 className="closest-call-headline">{headline}</h2>

        <p className="closest-call-desc">{desc}</p>

        {/* Voting Options / Actions */}
        {!votedSide && !showVoteOptions ? (
          <div className="closest-call-actions">
            <button
              type="button"
              className="btn-decide"
              onClick={() => setShowVoteOptions(true)}
            >
              Cast the deciding vote
            </button>
            <button
              type="button"
              className="btn-share-dilemma"
              onClick={handleShareClick}
            >
              Share the dilemma
            </button>
          </div>
        ) : !votedSide && showVoteOptions ? (
          <div className="closest-call-vote-box">
            <span className="closest-call-pick-hint">Pick a side to break the tie:</span>
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
                <strong>{pctA.toFixed(1)}% {votedSide === "a" ? "· yours" : ""}</strong>
              </div>
              <div className="bar-track">
                <div className="bar-fill-a" style={{ width: `${pctA}%` }} />
                <div className="bar-fill-b" style={{ width: `${pctB}%` }} />
              </div>
              <div className="revealed-bar-row">
                <span>{ob}</span>
                <strong>{pctB.toFixed(1)}% {votedSide === "b" ? "· yours" : ""}</strong>
              </div>
            </div>
            <div className="revealed-actions">
              <button type="button" className="btn-decide" onClick={handleShareClick}>
                Share where I landed
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right Circular Donut Gauge */}
      <div className="closest-call-gauge-wrap">
        <div
          className="donut-gauge"
          style={{
            background: `conic-gradient(from 180deg, #141712 0% ${pctA}%, #B8FF4F ${pctA}% 100%)`,
          }}
          role="img"
          aria-label={`${pctA.toFixed(1)} percent versus ${pctB.toFixed(1)} percent`}
        >
          <div className="donut-hole">
            <div className="donut-value">
              {pctA.toFixed(1)} / {pctB.toFixed(1)}
            </div>
            <div className="donut-label">THE INTERNET IS SPLIT</div>
          </div>
        </div>
      </div>
    </section>
  );
}
