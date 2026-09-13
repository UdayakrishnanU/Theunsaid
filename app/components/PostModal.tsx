"use client";
import { useEffect, useMemo, useState } from "react";
import { BGS, bgCss, bgPos, bgSize, floorBidBase, rupee, topBidBase } from "@/lib/board-helpers";
import { CurrencyDef, dp, fromBase, toBase, Tier } from "@/lib/currency";
import type { Post } from "@/lib/types";
import { api } from "@/app/lib-client/api";
import { useOwnerKey } from "@/app/hooks/useOwnerKey";
import { openRazorpayCheckout } from "@/app/lib-client/razorpayCheckout";
import TurnstileWidget from "./TurnstileWidget";

const CONFESSION_HEADLINE_MAX = 150;
const CONFESSION_DETAIL_MAX = 640;

const CATEGORY_OPTS: [string, string][] = [
  ["relationships", "Relationships"],
  ["work", "Work"],
  ["money", "Money"],
  ["family", "Family"],
  ["random", "Random"],
];

export default function PostModal({
  open,
  initialType,
  wantPin,
  posts,
  currency,
  onClose,
  onPosted,
}: {
  open: boolean;
  initialType: "confession" | "dilemma";
  wantPin: boolean;
  posts: Post[];
  currency: CurrencyDef;
  onClose: () => void;
  onPosted: (info: { postId: string; ownerKey: string; type: "confession" | "dilemma" }) => void;
}) {
  const { ensure } = useOwnerKey();
  const [type, setType] = useState<"confession" | "dilemma">(initialType);
  const [category, setCategory] = useState("relationships");
  const [text, setText] = useState("");
  const [detail, setDetail] = useState("");
  const [showDetail, setShowDetail] = useState(false);
  const [oa, setOa] = useState("");
  const [ob, setOb] = useState("");
  const [bg, setBg] = useState("plain");
  const [tier, setTier] = useState<Tier>(wantPin ? "pin" : "std");
  const [bidAmount, setBidAmount] = useState(0);
  const [warning, setWarning] = useState<string | null>(null);
  const [careFlag, setCareFlag] = useState(false);
  const [bidErr, setBidErr] = useState<string | null>(null);
  const [phase, setPhase] = useState<"form" | "paying" | "confirming">("form");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const floorBase = useMemo(() => floorBidBase(posts, currency.code), [posts, currency]);
  const topBase = useMemo(() => topBidBase(posts, currency.code), [posts, currency]);
  const floorMajor = fromBase(floorBase, currency.code);

  useEffect(() => {
    if (open) {
      setType(initialType);
      setTier(wantPin ? "pin" : "std");
      setBidAmount(floorMajor);
      setWarning(null);
      setCareFlag(false);
      setBidErr(null);
      setPhase("form");
      setDetail("");
      setShowDetail(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialType, wantPin]);

  if (!open) return null;

  const total = tier === "pin" ? bidAmount || floorMajor : tier === "glow" ? currency.glow : currency.post;

  async function submit() {
    setWarning(null);
    setCareFlag(false);
    setBidErr(null);
    if (type === "confession" && !text.trim()) return;
    if (type === "dilemma" && (!text.trim() || !oa.trim() || !ob.trim())) return;
    if (tier === "pin" && toBase(bidAmount || 0, currency.code) < floorBase) {
      setBidErr(`The shelf is held at ${rupee(floorBase - 100, currency.code)}. You need at least ${rupee(floorBase, currency.code)} to get on it.`);
      return;
    }

    const ownerKey = ensure();
    setPhase("paying");
    const confessionText = type === "confession" && detail.trim() ? `${text.trim()}\n\n${detail.trim()}` : text.trim();
    try {
      const res = await api.createPost({
        type,
        category,
        text: confessionText,
        optionA: type === "dilemma" ? oa.trim() : undefined,
        optionB: type === "dilemma" ? ob.trim() : undefined,
        bg,
        tier,
        currency: currency.code,
        bidAmount: tier === "pin" ? bidAmount : undefined,
        ownerKey,
        turnstileToken: turnstileToken ?? undefined,
      });
      if (res.careFlag) {
        setCareFlag(true);
        setPhase("form");
        return;
      }
      if (!res.razorpayKeyId) {
        setWarning(
          "Payment isn't configured on this deployment yet (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are missing). The draft was created but nothing will be charged and it will stay pending until that's set — see DEPLOY.md."
        );
        setPhase("form");
        return;
      }
      await openRazorpayCheckout({
        keyId: res.razorpayKeyId,
        orderId: res.order.id,
        amount: res.order.amount,
        currency: res.order.currency,
        name: "AnonVerdict",
        description: type === "confession" ? "Confession" : "Dilemma",
        onSuccess: async () => {
          setPhase("confirming");
          const ok = await pollUntilLive(res.postId);
          if (ok) onPosted({ postId: res.postId, ownerKey: res.ownerKey, type });
          else {
            setWarning(
              "Razorpay confirmed the charge but the board hasn't shown it live yet — it'll appear within a minute or two once the webhook lands. Check My posts."
            );
            setPhase("form");
          }
        },
        onDismiss: () => {
          setWarning("Payment window closed — nothing was charged, and your post won't go live until it's paid for.");
          setPhase("form");
        },
      });
    } catch (e) {
      setWarning(e instanceof Error ? e.message : "Something went wrong.");
      setPhase("form");
    }
  }

  async function pollUntilLive(postId: string): Promise<boolean> {
    for (let i = 0; i < 14; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      try {
        const r = await fetch(`/api/posts/${postId}/status`);
        const d = await r.json();
        if (d.status === "live") return true;
      } catch {
        /* keep polling */
      }
    }
    return false;
  }

  return (
    <div className="ov show" onClick={(e) => e.target === e.currentTarget && phase === "form" && onClose()}>
      <div className="md" role="dialog" aria-modal="true">
        <h3>{type === "confession" ? "Confess something" : "Let strangers decide"}</h3>
        <p className="s">{type === "confession" ? "No account. No name. Nothing traced back to you." : "Two options. Strangers pick one. You get an answer."}</p>

        {warning && (
          <div className="nt w show" role="alert">
            {warning}
          </div>
        )}
        {careFlag && (
          <div className="nt c show" role="alert">
            This sounds heavy, and a board of strangers isn&apos;t the right place to carry it. Please talk to someone who can help —{" "}
            <strong>findahelpline.com</strong> lists free, confidential crisis lines for almost every country. If you&apos;re in immediate danger, contact
            local emergency services.
          </div>
        )}

        <div className="typeseg" role="tablist">
          <button className={"tsg" + (type === "confession" ? " on" : "")} onClick={() => setType("confession")}>
            Confess something
          </button>
          <button className={"tsg" + (type === "dilemma" ? " on" : "")} onClick={() => setType("dilemma")}>
            Let strangers decide
          </button>
        </div>

        <div className="f">
          <label>Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORY_OPTS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>

        {type === "confession" ? (
          <div>
            <div className="f">
              <label>What is it?</label>
              <textarea
                maxLength={CONFESSION_HEADLINE_MAX}
                placeholder="The thing you've never typed anywhere with your name on it."
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <div className="cnt">{CONFESSION_HEADLINE_MAX - text.length} left</div>
            </div>
            {showDetail ? (
              <div className="f">
                <label>Add more detail (optional)</label>
                <textarea
                  maxLength={CONFESSION_DETAIL_MAX}
                  placeholder="Any extra context, if you want to give it."
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                />
                <div className="cnt">{CONFESSION_DETAIL_MAX - detail.length} left</div>
              </div>
            ) : (
              <button type="button" className="lnk" style={{ padding: "6px 0" }} onClick={() => setShowDetail(true)}>
                + Add more detail
              </button>
            )}
          </div>
        ) : (
          <div>
            <div className="f">
              <label>What&apos;s the situation?</label>
              <textarea maxLength={800} placeholder="Give strangers just enough to judge it fairly." value={text} onChange={(e) => setText(e.target.value)} />
              <div className="cnt">{800 - text.length} left</div>
            </div>
            <div className="pr">
              <div className="f">
                <label>Option A</label>
                <input maxLength={22} placeholder="Stay" value={oa} onChange={(e) => setOa(e.target.value)} />
              </div>
              <div className="f">
                <label>Option B</label>
                <input maxLength={22} placeholder="Leave" value={ob} onChange={(e) => setOb(e.target.value)} />
              </div>
            </div>
          </div>
        )}

        <div style={{ margin: "20px 0 4px" }}>
          <div style={{ fontSize: 12.5, color: "var(--dim)", marginBottom: 8 }}>Background</div>
          <div className="bgs">
            {BGS.map(([key, label]) => (
              <button
                key={key}
                className={"bgb" + (bg === key ? " on" : "")}
                title={label}
                aria-label={label}
                onClick={() => setBg(key)}
                style={{
                  ["--a" as string]: "#F43F5E",
                  backgroundColor: "#FFF1F4",
                  backgroundImage: bgCss(key, "#F43F5E"),
                  backgroundSize: bgSize(key),
                  backgroundPosition: bgPos(key),
                }}
              />
            ))}
          </div>

          <div style={{ fontSize: 12.5, color: "var(--dim)", margin: "18px 0 8px" }}>How should it appear?</div>
          <label className={"to" + (tier === "std" ? " on" : "")}>
            <input type="radio" name="tr" checked={tier === "std"} onChange={() => setTier("std")} />
            <span style={{ flex: 1 }}>
              <span className="h">
                <span>Standard</span>
                <span>{currency.sym + currency.post}</span>
              </span>
              <span className="d">Onto the ranked board with everything else.</span>
            </span>
          </label>
          <label className={"to" + (tier === "glow" ? " on" : "")}>
            <input type="radio" name="tr" checked={tier === "glow"} onChange={() => setTier("glow")} />
            <span style={{ flex: 1 }}>
              <span className="h">
                <span>Highlighted</span>
                <span>{currency.sym + currency.glow}</span>
              </span>
              <span className="d">Its own glowing card above the board for 24 hours.</span>
            </span>
          </label>
          <label className={"to" + (tier === "pin" ? " on" : "")}>
            <input type="radio" name="tr" checked={tier === "pin"} onChange={() => setTier("pin")} />
            <span style={{ flex: 1 }}>
              <span className="h">
                <span>Pinned — top shelf</span>
                <span>from {rupee(floorBase, currency.code)}</span>
              </span>
              <span className="d">Beat the lowest live bid. The five highest hold the shelf.</span>
              {tier === "pin" && (
                <span className="bidbox" style={{ display: "block" }}>
                  <label>Your bid</label>
                  <input
                    type="number"
                    min={floorMajor}
                    step={dp(currency.code) === 0 ? "1" : "0.01"}
                    value={bidAmount || floorMajor}
                    onChange={(e) => setBidAmount(Number(e.target.value))}
                  />
                  <span className="hint">
                    Minimum {rupee(floorBase, currency.code)} to get on the shelf. {rupee(topBase, currency.code)} takes the #1 spot outright. Bids are not
                    refundable and can be beaten.
                  </span>
                  {bidErr && <span className="err show">{bidErr}</span>}
                </span>
              )}
            </span>
          </label>
        </div>

        <div className="tot">
          <span style={{ fontSize: 13, color: "var(--dim)" }}>Total</span>
          <span className="a">
            {currency.sym}
            {total}
          </span>
        </div>
        <p className="ph">
          Pay with <strong>{currency.rail}</strong>.
        </p>
        <TurnstileWidget onToken={setTurnstileToken} />
        <div className="ma">
          <button className="btn gh" onClick={onClose} disabled={phase !== "form"}>
            Cancel
          </button>
          <button className="btn" onClick={submit} disabled={phase !== "form"}>
            {phase === "form" ? "Pay and post" : phase === "paying" ? "Opening payment…" : "Confirming payment…"}
          </button>
        </div>
      </div>
    </div>
  );
}
