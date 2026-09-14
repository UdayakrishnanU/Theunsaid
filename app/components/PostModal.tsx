"use client";
import { useEffect, useState } from "react";
import { BGS, bgCss, bgPos, bgSize, floorBidBase, rupee, topBidBase, BOOSTED_SHADES } from "@/lib/board-helpers";
import { CurrencyDef, dp, fromBase, toBase, Tier } from "@/lib/currency";
import type { Post } from "@/lib/types";
import { api } from "@/app/lib-client/api";
import { useOwnerKey } from "@/app/hooks/useOwnerKey";
import { openCashfreeCheckout } from "@/app/lib-client/cashfreeCheckout";
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
  // One id per time this modal opens. Retrying "Pay and post" without closing
  // the modal (because the first attempt seemed to hang) reuses this same id,
  // so the server can tell it's the same draft instead of creating a second
  // post and a second Cashfree order for one intended submission.
  const [idemKey, setIdemKey] = useState<string>(() => (typeof crypto !== "undefined" ? crypto.randomUUID() : Math.random().toString(36).slice(2)));
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [skipPayment, setSkipPayment] = useState(false);

  // "Test post, no payment" is a debug affordance, not something a real
  // visitor should ever see or be able to trigger — the server re-checks the
  // admin session cookie itself before honoring it either way (see
  // app/api/posts/route.ts), this is purely to hide the checkbox.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/whoami")
      .then((r) => (r.ok ? r.json() : { isAdmin: false }))
      .then((j) => {
        if (!cancelled) setIsAdminUser(!!j.isAdmin);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Local estimate for the very first paint, refined immediately below by the
  // real server-computed price (lib/pinPricing.ts) — never the other way
  // around, so what's shown here can never drift from what POST /api/posts
  // will actually accept.
  const [floorBase, setFloorBase] = useState(() => floorBidBase(posts, currency.code));
  const [topBase, setTopBase] = useState(() => topBidBase(posts, currency.code));
  const floorMajor = fromBase(floorBase, currency.code);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    api
      .pinFloor(currency.code)
      .then((r) => {
        if (cancelled) return;
        setFloorBase(r.floorBase);
        setTopBase(r.topBase);
        const realFloorMajor = fromBase(r.floorBase, currency.code);
        setBidAmount((prev) => (prev && prev >= realFloorMajor ? prev : realFloorMajor));
      })
      .catch(() => {
        // Network hiccup — keep the local estimate. The real check still
        // happens server-side at submit time either way.
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currency.code]);

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
      setIdemKey(typeof crypto !== "undefined" ? crypto.randomUUID() : Math.random().toString(36).slice(2));
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
        idempotencyKey: idemKey,
        devSkipPayment: isAdminUser && skipPayment ? true : undefined,
      });
      if (res.careFlag) {
        setCareFlag(true);
        setPhase("form");
        return;
      }
      if (res.dev) {
        // Admin test post — already live, no Cashfree order was ever opened.
        onPosted({ postId: res.postId, ownerKey: res.ownerKey, type });
        return;
      }
      if (!res.cashfree || !res.order) {
        setWarning("Payments aren't available on this deployment right now. Your draft was saved and won't be charged — try again in a few minutes.");
        setPhase("form");
        return;
      }
      await openCashfreeCheckout({
        paymentSessionId: res.cashfree.paymentSessionId,
        mode: res.cashfree.mode,
        orderId: res.order.id,
        onSuccess: async ({ orderId }) => {
          setPhase("confirming");
          try {
            await api.confirmPayment(res.postId, { orderId });
            onPosted({ postId: res.postId, ownerKey: res.ownerKey, type });
            return;
          } catch {
            // Instant confirmation didn't go through (a network hiccup, most
            // likely) — fall back to waiting for the webhook, which is still
            // the authoritative path either way.
          }
          const ok = await pollUntilLive(res.postId);
          if (ok) {
            onPosted({ postId: res.postId, ownerKey: res.ownerKey, type });
          } else {
            setWarning(
              "The payment went through, but the post hasn't gone live here yet — that can take a couple of minutes. It'll show up on My posts as soon as it lands; if it's still stuck after 10 minutes, contact support with your recovery key and we'll sort it out."
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
    // ~55s total, backing off — long enough to cover a slow webhook delivery
    // without leaving the customer staring at a spinner the whole time.
    const delays = [1000, 1000, 1500, 1500, 2000, 2000, 2500, 3000, 3000, 3500, 4000, 4000, 5000, 5000, 5000, 5000];
    for (const delay of delays) {
      await new Promise((r) => setTimeout(r, delay));
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
          <div style={{ fontSize: 12.5, color: "var(--dim)", margin: "0 0 8px" }}>How should it appear?</div>
          <label className={"to" + (tier === "std" ? " on" : "")}>
            <input
              type="radio"
              name="tr"
              checked={tier === "std"}
              onChange={() => {
                setTier("std");
                if (BOOSTED_SHADES[bg]) setBg("plain");
              }}
            />
            <span style={{ flex: 1 }}>
              <span className="h">
                <span>Standard</span>
                <span>{currency.sym + currency.post}</span>
              </span>
              <span className="d">Onto the ranked board with everything else.</span>
            </span>
          </label>
          <label className={"to" + (tier === "glow" ? " on" : "")}>
            <input
              type="radio"
              name="tr"
              checked={tier === "glow"}
              onChange={() => {
                setTier("glow");
                if (!BOOSTED_SHADES[bg]) setBg("rose");
              }}
            />
            <span style={{ flex: 1 }}>
              <span className="h">
                <span>Boosted</span>
                <span>{currency.sym + currency.glow}</span>
              </span>
              <span className="d">Its own glowing card above the board for 24 hours.</span>
            </span>
          </label>
          <label className={"to" + (tier === "pin" ? " on" : "")}>
            <input
              type="radio"
              name="tr"
              checked={tier === "pin"}
              onChange={() => {
                setTier("pin");
                if (BOOSTED_SHADES[bg]) setBg("plain");
              }}
            />
            <span style={{ flex: 1 }}>
              <span className="h">
                <span>Pinned — top shelf</span>
                <span>from {rupee(floorBase, currency.code)}</span>
              </span>
              <span className="d">Beat the current highest bid to take the one shelf spot.</span>
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

          {/* Dynamic Background Selector: Boosted Shades vs Standard Patterns */}
          {tier === "glow" ? (
            <div style={{ margin: "18px 0 6px" }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>Boosted Card Glow Shade</span>
                <span style={{ fontSize: 11, fontWeight: 500, color: "var(--dim)" }}>
                  Visible on the board
                </span>
              </div>
              <div className="boosted-shades-grid">
                {Object.values(BOOSTED_SHADES).map((s) => {
                  const on = bg === s.key;
                  return (
                    <button
                      type="button"
                      key={s.key}
                      className={"shade-pill-btn" + (on ? " on" : "")}
                      onClick={() => setBg(s.key)}
                      style={{
                        background: s.bgGradient,
                        borderColor: on ? s.accent : s.border,
                        boxShadow: on ? `0 0 0 2px ${s.accent}, 0 4px 12px ${s.accent}30` : undefined,
                      }}
                    >
                      <span className="shade-circle" style={{ background: s.accent }} />
                      <span className="shade-name" style={{ color: s.textDark, fontWeight: on ? 700 : 600 }}>
                        {s.label}
                      </span>
                      {on && (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={s.accent} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: "auto" }}>
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : tier === "std" ? (
            <div style={{ margin: "18px 0 4px" }}>
              <div style={{ fontSize: 12.5, color: "var(--dim)", marginBottom: 8 }}>Background pattern</div>
              <div className="bgs">
                {BGS.map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
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
            </div>
          ) : null}
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
        {isAdminUser && (
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--dim)", marginTop: 4 }}>
            <input type="checkbox" checked={skipPayment} onChange={(e) => setSkipPayment(e.target.checked)} />
            Test post — skip payment (admin only, not charged)
          </label>
        )}
        <TurnstileWidget onToken={setTurnstileToken} />
        <div className="ma">
          <button className="btn gh" onClick={onClose} disabled={phase !== "form"}>
            Cancel
          </button>
          <button className="btn" onClick={submit} disabled={phase !== "form"}>
            {phase === "form" ? (isAdminUser && skipPayment ? "Post (no charge)" : "Pay and post") : phase === "paying" ? "Opening payment…" : "Confirming payment…"}
          </button>
        </div>
      </div>
    </div>
  );
}
