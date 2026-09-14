"use client";
import { eng, nf, rupee, vsum } from "@/lib/board-helpers";
import type { Post } from "@/lib/types";
import type { CurrencyCode } from "@/lib/currency";

// SLOTS is 1, so this card is always "the" pinned post — there is no ranked
// #2/#3 state to render. (There used to be, for a 5-slot shelf; keeping that
// dead branch around was exactly what caused the pricing copy to drift from
// what the shelf actually does — see the audit.)
import PostCard from "./PostCard";

export function PinCard({
  post,
  currency,
  onOpen,
  onShare = () => {},
  onVote = () => {},
  onReact = () => {},
  onReport = () => {},
  votedSide,
  reported = false,
}: {
  post: Post;
  currency: CurrencyCode;
  onOpen: () => void;
  onShare?: () => void;
  onVote?: (side: "a" | "b") => void;
  onReact?: (key: string) => void;
  onReport?: () => void;
  votedSide?: "a" | "b";
  reported?: boolean;
}) {
  return (
    <div className="pin-card-outer">
      <PostCard
        post={post}
        pinned={true}
        onOpen={onOpen}
        onShare={onShare}
        onVote={onVote}
        onReact={onReact}
        onReport={onReport}
        votedSide={votedSide}
        reported={reported}
      />
    </div>
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
