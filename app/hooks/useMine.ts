"use client";
import { useLocalState } from "./useLocalState";

/** Client-side "have I already voted / reacted / posted this" bookkeeping,
 * purely for instant UI feedback (disabling a button, showing "yours").
 * The server is the actual source of truth and enforces the real uniqueness
 * constraint per browser via the voter-id cookie — this can't be used to
 * cheat, only to skip a round trip for the UI state. */
export function useMine() {
  const [votes, setVotes] = useLocalState<Record<string, "a" | "b">>("unsaid_votes_v2", {});
  const [reactions, setReactions] = useLocalState<Record<string, string[]>>("unsaid_reactions_v2", {});
  const [myIds, setMyIds] = useLocalState<string[]>("unsaid_mine_ids", []);
  const [seenOutbid, setSeenOutbid] = useLocalState<string[]>("unsaid_seen_outbid", []);

  const recordVote = (postId: string, side: "a" | "b") => setVotes({ ...votes, [postId]: side });
  const recordReaction = (postId: string, key: string) => {
    const cur = reactions[postId] || [];
    if (!cur.includes(key)) setReactions({ ...reactions, [postId]: [...cur, key] });
  };
  const addMine = (id: string) => {
    if (!myIds.includes(id)) setMyIds([...myIds, id]);
  };
  const dismissOutbid = (id: string) => {
    if (!seenOutbid.includes(id)) setSeenOutbid([...seenOutbid, id]);
  };

  return {
    votedSide: (id: string) => votes[id],
    hasReacted: (id: string, key: string) => (reactions[id] || []).includes(key),
    votedIds: new Set(Object.keys(votes)),
    myIds,
    isMine: (id: string) => myIds.includes(id),
    seenOutbid,
    recordVote,
    recordReaction,
    addMine,
    dismissOutbid,
  };
}
