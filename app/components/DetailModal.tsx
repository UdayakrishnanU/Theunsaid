"use client";
import { useState } from "react";
import { ago, CHIPS, nf, rupee, tvars, vsum } from "@/lib/board-helpers";
import type { Post } from "@/lib/types";
import type { CurrencyCode } from "@/lib/currency";
import { api } from "@/app/lib-client/api";

export default function DetailModal({
  post,
  isMine,
  ownerKey,
  onShelf,
  currency,
  votedSide,
  reactedKeys,
  onClose,
  onVote,
  onReact,
  onReport,
  onDeleted,
  onOutcomePosted,
  onShare,
  onCopyLink,
  reported = false,
}: {
  post: Post | null;
  isMine: boolean;
  ownerKey: string | null;
  onShelf: boolean;
  currency: CurrencyCode;
  votedSide?: "a" | "b";
  reactedKeys: string[];
  onClose: () => void;
  onVote: (side: "a" | "b") => void;
  onReact: (key: string) => void;
  onReport: () => void;
  onDeleted: () => void;
  onOutcomePosted: (outcome: NonNullable<Post["outcome"]>) => void;
  onShare: () => void;
  onCopyLink: () => void;
  reported?: boolean;
}) {
  const [choice, setChoice] = useState<"a" | "b" | "other" | null>(null);
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!post) return null;
  const t = vsum(post);
  const pa = t ? Math.round((post.va / t) * 100) : 50;

  async function submitOutcome() {
    if (!choice) {
      setErr("Pick what you did first.");
      return;
    }
    if (!ownerKey) return;
    setBusy(true);
    try {
      await api.outcome(post!.id, { ownerKey, choice, note: note.trim() || null });
      onOutcomePosted({ choice, note: note.trim() || null, at: Date.now() });
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save that.");
    } finally {
      setBusy(false);
    }
  }

  async function doDelete() {
    if (!ownerKey) return;
    setBusy(true);
    try {
      await api.deletePost(post!.id, ownerKey);
      onDeleted();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not delete that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ov show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={"md detail" + (onShelf ? " gold" : "")} style={tvars(post)} role="dialog" aria-modal="true">
        <button className="dclose" onClick={onClose} aria-label="Close">
          ×
        </button>
        <div className="meta" style={{ marginBottom: 12 }}>
          <span className="cat">{post.category}</span>
          {onShelf && (
            <span className="tag" style={{ background: "#F59E0B" }}>
              Pinned · {rupee(post.paid || 0, currency)}
            </span>
          )}
          {isMine && (
            <span className="tag" style={{ background: "#0EA5E9" }}>
              Yours
            </span>
          )}
          <span className="sep">·</span>
          <span className="t">{ago(post.at)}</span>
        </div>
        <p className="txt" style={{ fontSize: 24, maxWidth: "none" }}>
          {post.type === "confession" ? `“${post.text}”` : post.text}
        </p>

        {post.type === "dilemma" && (
          <div className="bar-wrap">
            <div className="blab">
              <span>{post.oa}</span>
              <span className="r">{post.ob}</span>
            </div>
            <div className={"bar" + (votedSide ? " done" : "")}>
              <button className="sd a" style={{ flexBasis: (votedSide ? pa : 50) + "%" }} disabled={!!votedSide} onClick={() => onVote("a")}>
                {votedSide ? pa + "%" : ""}
              </button>
              <button className="sd b" style={{ flexBasis: (votedSide ? 100 - pa : 50) + "%" }} disabled={!!votedSide} onClick={() => onVote("b")}>
                {votedSide ? 100 - pa + "%" : ""}
              </button>
            </div>
            <div className="tally">{nf(t)} votes</div>
          </div>
        )}

        {post.outcome && (
          <div className="outcome">
            <div className="oh">What they actually did</div>
            <div className="ob">{post.outcome.choice === "a" ? post.oa : post.outcome.choice === "b" ? post.ob : "something else"}</div>
            {post.outcome.note && <p className="on">“{post.outcome.note}”</p>}
            <div className="om">
              {nf(t)} people voted · {pa}% said {post.oa} · resolved {ago(post.outcome.at)}
            </div>
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
          <button
            className="lnk"
            onClick={() => {
              onCopyLink();
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            }}
          >
            {copied ? "Link copied" : "Copy link"}
          </button>
          <span className="sp" />
          {isMine ? (
            <button className="lnk" style={{ color: "#B91C1C" }} onClick={doDelete} disabled={busy}>
              Delete
            </button>
          ) : (
            <button
              className={"lnk rep" + (reported ? " on" : "")}
              onClick={onReport}
              disabled={reported}
            >
              {reported ? "Reported" : "Report"}
            </button>
          )}
        </div>

        {isMine && post.type === "dilemma" && !post.outcome && (
          <div className="resolve">
            <div className="rh">You asked. {nf(t)} strangers answered. What did you do?</div>
            <div className="rbtns">
              <button className={"rb" + (choice === "a" ? " on" : "")} onClick={() => setChoice("a")}>
                {post.oa}
              </button>
              <button className={"rb" + (choice === "b" ? " on" : "")} onClick={() => setChoice("b")}>
                {post.ob}
              </button>
              <button className={"rb" + (choice === "other" ? " on" : "")} onClick={() => setChoice("other")}>
                Something else
              </button>
            </div>
            <textarea maxLength={220} placeholder="Optional — what happened? (220 characters)" value={note} onChange={(e) => setNote(e.target.value)} />
            {err && <div className="rerr show">{err}</div>}
            <button className="btn" style={{ width: "100%", justifyContent: "center", marginTop: 8 }} onClick={submitOutcome} disabled={busy}>
              Post the outcome
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
