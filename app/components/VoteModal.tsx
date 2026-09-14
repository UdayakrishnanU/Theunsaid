"use client";
import { useEffect, useRef, useState } from "react";
import { nf } from "@/lib/board-helpers";
import type { Post } from "@/lib/types";

export default function VoteModal({
  open,
  queue,
  votedToday,
  onClose,
  onVote,
}: {
  open: boolean;
  queue: Post[];
  votedToday: number;
  onClose: () => void;
  onVote: (id: string, side: "a" | "b") => Promise<{ va: number; vb: number; failed?: boolean }>;
}) {
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(0);
  const [result, setResult] = useState<{ side: "a" | "b"; va: number; vb: number } | null>(null);
  const [voting, setVoting] = useState(false);
  const [voteErr, setVoteErr] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setIdx(0);
      setDone(0);
      setResult(null);
      setVoting(false);
      setVoteErr(null);
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [open]);

  if (!open) return null;

  const p = queue[idx];

  async function vote(side: "a" | "b") {
    if (!p || voting) return;
    setVoting(true);
    setVoteErr(null);
    const r = await onVote(p.id, side);
    setVoting(false);
    if (r.failed) {
      setVoteErr("That vote didn't go through. Try again, or skip this one.");
      return;
    }
    setResult({ side, va: r.va, vb: r.vb });
    setDone((d) => d + 1);
    timer.current = setTimeout(() => {
      setResult(null);
      setIdx((i) => i + 1);
    }, 2600);
  }

  function next() {
    if (timer.current) clearTimeout(timer.current);
    setResult(null);
    setVoteErr(null);
    setIdx((i) => i + 1);
  }

  return (
    <div className="ov vm show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="vmbox" role="dialog" aria-modal="true">
        {!p ? (
          <div className="vmdone">
            <div className="vmbig">{nf(done)}</div>
            <p className="vmt">{done === 1 ? "vote cast" : "votes cast"} just now</p>
            <p className="vms">That is the whole queue. {nf(votedToday)} today in total.</p>
            <div className="vmacts">
              <button className="btn gh" onClick={onClose}>
                Back to the board
              </button>
            </div>
          </div>
        ) : result ? (
          (() => {
            const t = result.va + result.vb;
            const pa = t ? Math.round((result.va / t) * 100) : 50;
            const agree = (result.side === "a" ? pa : 100 - pa) >= 50;
            return (
              <>
                <div className="vmhead">
                  <span className="vmcount">
                    {idx + 1} of {nf(queue.length)}
                  </span>
                  <span className="vmstreak">{nf(votedToday)} voted today</span>
                  <button className="vmx" onClick={onClose} aria-label="Close">
                    ×
                  </button>
                </div>
                <div className="vmprog">
                  <span style={{ width: `${((idx + 1) / queue.length) * 100}%` }} />
                </div>
                <p className="vmq small">{p.text}</p>
                <div className="vmres">
                  <div className={"vmrow" + (result.side === "a" ? " you" : "")}>
                    <span className="vl">{p.oa}</span>
                    <span className="vb">
                      <i style={{ width: pa + "%" }} />
                    </span>
                    <span className="vp">{pa}%</span>
                  </div>
                  <div className={"vmrow" + (result.side === "b" ? " you" : "")}>
                    <span className="vl">{p.ob}</span>
                    <span className="vb">
                      <i style={{ width: 100 - pa + "%" }} />
                    </span>
                    <span className="vp">{100 - pa}%</span>
                  </div>
                </div>
                <p className="vmverdict">
                  {agree ? "You are with the majority." : "You are in the minority here."} <span className="vmsub">{nf(t)} votes</span>
                </p>
                <div className="vmacts">
                  <button className="btn" onClick={next}>
                    Next dilemma
                  </button>
                  <button className="btn gh" onClick={onClose}>
                    Stop
                  </button>
                </div>
              </>
            );
          })()
        ) : (
          <>
            <div className="vmhead">
              <span className="vmcount">
                {idx + 1} of {nf(queue.length)}
              </span>
              <span className="vmstreak">{nf(votedToday)} voted today</span>
              <button className="vmx" onClick={onClose} aria-label="Close">
                ×
              </button>
            </div>
            <div className="vmprog">
              <span style={{ width: `${(idx / queue.length) * 100}%` }} />
            </div>
            <div className="vmcat">{p.category}</div>
            <p className="vmq">{p.text}</p>
            <div className="vmopts">
              <button className="vmo" onClick={() => vote("a")} disabled={voting}>
                <span>{p.oa}</span>
              </button>
              <button className="vmo" onClick={() => vote("b")} disabled={voting}>
                <span>{p.ob}</span>
              </button>
            </div>
            {voteErr ? (
              <div className="vmerr">
                <p>{voteErr}</p>
                <button className="btn gh" onClick={next}>
                  Skip this one
                </button>
              </div>
            ) : (
              <p className="vmhint">
                {nf(p.va + p.vb)} {p.va + p.vb === 1 ? "person has" : "people have"} already picked a side
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
