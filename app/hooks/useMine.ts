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
  // Which specific key code owns each post — populated both when you post
  // (the key you just posted with) and when you restore a key from another
  // device (every post that key claims). Board.tsx uses this instead of
  // always assuming "my first key on this device" owns whatever you're
  // looking at, which used to send the wrong key for anything restored from
  // elsewhere and fail with an unexplained "that key doesn't own this".
  const [ownerKeyFor, setOwnerKeyFor] = useLocalState<Record<string, string>>("unsaid_post_owner_key", {});
  const [seenOutbid, setSeenOutbid] = useLocalState<string[]>("unsaid_seen_outbid", []);
  const [reported, setReported] = useLocalState<string[]>("unsaid_reported_v1", []);

  const recordVote = (postId: string, side: "a" | "b") => setVotes({ ...votes, [postId]: side });
  const recordReaction = (postId: string, key: string) => {
    const cur = reactions[postId] || [];
    if (!cur.includes(key)) setReactions({ ...reactions, [postId]: [...cur, key] });
  };
  const addMine = (id: string) => {
    if (!myIds.includes(id)) setMyIds([...myIds, id]);
  };
  const recordOwner = (id: string, code: string) => {
    if (ownerKeyFor[id] !== code) setOwnerKeyFor({ ...ownerKeyFor, [id]: code });
  };
  const dismissOutbid = (id: string) => {
    if (!seenOutbid.includes(id)) setSeenOutbid([...seenOutbid, id]);
  };
  const recordReport = (id: string) => {
    if (!reported.includes(id)) setReported([...reported, id]);
  };
  // Undo the optimistic "I already did this" mark when the request that was
  // supposed to make it true never actually went through, so the person can
  // try again instead of being stuck permanently disabled.
  const clearVote = (id: string) => {
    if (!(id in votes)) return;
    const next = { ...votes };
    delete next[id];
    setVotes(next);
  };
  const clearReaction = (id: string, key: string) => {
    const cur = reactions[id] || [];
    if (!cur.includes(key)) return;
    setReactions({ ...reactions, [id]: cur.filter((k) => k !== key) });
  };
  const clearReport = (id: string) => {
    if (!reported.includes(id)) return;
    setReported(reported.filter((x) => x !== id));
  };

  return {
    votedSide: (id: string) => votes[id],
    hasReacted: (id: string, key: string) => (reactions[id] || []).includes(key),
    votedIds: new Set(Object.keys(votes)),
    myIds,
    isMine: (id: string) => myIds.includes(id),
    ownerKeyFor: (id: string) => ownerKeyFor[id],
    recordOwner,
    seenOutbid,
    hasReported: (id: string) => reported.includes(id),
    recordVote,
    recordReaction,
    addMine,
    dismissOutbid,
    recordReport,
    clearVote,
    clearReaction,
    clearReport,
  };
}
