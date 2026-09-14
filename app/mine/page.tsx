"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useOwnerKey } from "@/app/hooks/useOwnerKey";
import { useMine } from "@/app/hooks/useMine";
import { useLocalState } from "@/app/hooks/useLocalState";
import { api } from "@/app/lib-client/api";
import { openCashfreeCheckout } from "@/app/lib-client/cashfreeCheckout";
import { ago, nf, rsum, vsum, CHIPS } from "@/lib/board-helpers";
import type { Post } from "@/lib/types";
import ShareStudioModal from "@/app/components/ShareStudioModal";
import type { CardFormat, CardVariant, ShareCardData } from "@/app/lib-client/shareCardCanvas";

type OwnedPost = Post & { status: string };
type EngagedPost = Post & { status: string; yourVote?: "a" | "b"; yourReactions?: string[] };

const CHIP_EMOJI: Record<string, string> = Object.fromEntries(CHIPS.map(([k, emoji]) => [k, emoji]));

// Combine two engaged-post lists without silently dropping one side when the
// SAME post appears in both -- which happens whenever two keys that are now
// both held on this device separately voted/reacted to the same post (e.g.
// one key reacted "red flag" from one device, another key reacted "same" to
// the very same post from a different device, and both keys just ended up
// restored together here). A plain id-based dedupe would keep only whichever
// list "won", quietly hiding a real reaction. `newer` wins on ties.
function mergeEngaged(newer: EngagedPost[], existing: EngagedPost[]): EngagedPost[] {
  const merged = new Map<string, EngagedPost>();
  for (const p of existing) merged.set(p.id, p);
  for (const hit of newer) {
    const prev = merged.get(hit.id);
    merged.set(hit.id, prev
      ? {
          ...hit,
          yourVote: hit.yourVote ?? prev.yourVote,
          yourReactions: Array.from(new Set([...(prev.yourReactions ?? []), ...(hit.yourReactions ?? [])])),
        }
      : hit);
  }
  // Keep the newly-restored posts floating to the top (matches the existing
  // "posts" merge behavior below), everything else keeps its prior order.
  const newerIds = new Set(newer.map((h) => h.id));
  return [...newer.map((h) => merged.get(h.id)!), ...existing.filter((p) => !newerIds.has(p.id))];
}

export default function MinePage() {
  const router = useRouter();
  const { key, codes, ensure, addCode } = useOwnerKey();
  const mine = useMine();
  const [posts, setPosts] = useState<OwnedPost[]>([]);
  const [engaged, setEngaged] = useState<EngagedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimIn, setClaimIn] = useState("");
  const [claimErr, setClaimErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  // Whether the CURRENT primary key (the one shown in the "Your key" box)
  // actually owns any posts, as of its last real load. Starts true so we
  // never promote a restored key before we've actually checked. Used to
  // decide, in restore(), whether a freshly-restored key should become the
  // new primary key instead of just being added as an extra one — see
  // restore() below and useOwnerKey.addCode's `promote` flag.
  const [primaryOwnsAny, setPrimaryOwnsAny] = useState(true);

  // Quiet "you have updates" signal — no push, no accounts, just: did any
  // post you own or engaged with get an outcome reported since the last time
  // you opened this page. `lastSeen` persists across visits; `freshIds` is
  // just for this render (which cards get the "new" dot) and is recomputed,
  // never persisted, so a stale banner can never survive a refresh.
  const [lastSeen, setLastSeen] = useLocalState<number>("unsaid_mine_last_seen", 0);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const [paymentNotice, setPaymentNotice] = useState<string | null>(null);
  // Auto-shown once, right after a real Cashfree payment confirms (see the
  // cf_order_id effect below) -- closes the "did my payment go through"
  // loop the same way the instant/no-redirect post flow already does on
  // the board (Board.tsx's handleDismissKeyPopup), which this page never
  // had, since a real payment redirects the browser away and back here
  // instead of staying on the page that created the post.
  const [shareData, setShareData] = useState<ShareCardData | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareVariant, setShareVariant] = useState<CardVariant>("curiosity");
  const [shareFormat, setShareFormat] = useState<CardFormat>("og");

  function noteFreshOutcomes(items: (OwnedPost | EngagedPost)[]) {
    // useLocalState's setter takes a plain value, not an updater — read
    // `lastSeen` from the closure (fine here: this only ever runs right
    // after a real load/restore, never twice in the same render pass).
    const newly = items.filter((p) => p.outcome && p.outcome.at > lastSeen).map((p) => p.id);
    if (newly.length) setFreshIds((cur) => new Set([...cur, ...newly]));
    setLastSeen(Date.now());
  }

  useEffect(() => {
    ensure();
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const cfOrderId = params.get("cf_order_id");
      if (cfOrderId) {
        window.history.replaceState({}, document.title, window.location.pathname);
        const postId = cfOrderId.split("-r")[0];
        setPaymentNotice("Verifying your payment...");
        api
          .confirmPayment(postId, { orderId: cfOrderId })
          .then(() => {
            setPaymentNotice("Payment received! Your post is now live.");
            return reload(true);
          })
          .catch(() => {
            setPaymentNotice("Payment received. Processing your post...");
            return reload(true);
          })
          .then((result) => {
            const paidPost = result?.posts.find((p) => p.id === postId);
            if (paidPost) openPostShareCard(paidPost);
          });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetches and merges EVERY held key, not just the primary one -- a key
  // you restored earlier stays merged in on every future visit instead of
  // only showing up right after the "Restore posts" click that added it.
  // (Before this, a fresh page load re-fetched only `codes[0]`, so anything
  // that came from an "also holding" key quietly vanished on reload.)
  async function reload(silent = false): Promise<{ posts: OwnedPost[]; engaged: EngagedPost[] } | undefined> {
    if (!codes.length) {
      setLoading(false);
      return { posts: [], engaged: [] };
    }
    if (!silent) setLoading(true);
    try {
      const results = await Promise.all(
        codes.map((c) =>
          api.claim(c).then(
            (r) => ({ code: c, posts: r.posts, engaged: r.engaged }),
            () => ({ code: c, posts: [] as OwnedPost[], engaged: [] as EngagedPost[] })
          )
        )
      );
      let mergedPosts: OwnedPost[] = [];
      let mergedEngaged: EngagedPost[] = [];
      for (const { code, posts: p, engaged: e } of results) {
        p.forEach((post) => {
          mine.addMine(post.id);
          mine.recordOwner(post.id, code);
        });
        e.forEach((post) => {
          if (post.yourVote) mine.recordVote(post.id, post.yourVote);
          (post.yourReactions ?? []).forEach((r) => mine.recordReaction(post.id, r));
        });
        mergedPosts = [...mergedPosts, ...p.filter((post) => !mergedPosts.some((x) => x.id === post.id))];
        mergedEngaged = mergeEngaged(e, mergedEngaged);
      }
      setPosts(mergedPosts);
      setEngaged(mergedEngaged);
      if (!silent) {
        // Whether the PRIMARY key specifically owns anything -- restore()
        // needs this to decide whether a freshly-restored key should become
        // primary, so it has to reflect codes[0] alone, not the merged set.
        const primary = results[0];
        setPrimaryOwnsAny(!!primary && (primary.posts.length > 0 || primary.engaged.length > 0));
        noteFreshOutcomes([...mergedPosts, ...mergedEngaged]);
      }
      return { posts: mergedPosts, engaged: mergedEngaged };
    } catch {
      if (!silent) {
        setPosts([]);
        setEngaged([]);
        setPrimaryOwnsAny(false);
      }
      return { posts: [], engaged: [] };
    } finally {
      if (!silent) setLoading(false);
    }
  }

  // Mirrors Board.tsx's openShareStudio()/handleDismissKeyPopup() -- same
  // card shape, same default variant ("curiosity" == "Ask Friends, No
  // Spoilers") and format ("og" banner), just triggered from the
  // post-payment redirect instead of the in-page post-creation popup.
  function openPostShareCard(p: OwnedPost) {
    const t = vsum(p);
    const pa = t ? Math.round((p.va / t) * 100) : 50;
    setShareData({
      id: p.id,
      category: p.category || (p.type === "dilemma" ? "DILEMMA" : "CONFESSION"),
      story: p.text,
      optionA: p.oa || "Option A",
      optionB: p.ob || "Option B",
      pctA: pa,
      votes: t,
      outcome: p.outcome?.note || (p.outcome ? `Chose ${p.outcome.choice === "a" ? p.oa : p.ob}` : undefined),
    });
    setShareVariant("curiosity");
    setShareFormat("og");
    setShareOpen(true);
  }

  useEffect(() => {
    reload(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codes]);

  // A payment that's still "processing" — because the tab was closed before
  // the webhook landed, or a resume happened elsewhere — used to just sit
  // there forever unless you manually refreshed. Quietly re-check for you
  // while any post is in that state, instead of making that your job.
  const pendingCount = posts.filter((p) => p.status === "pending_payment").length;
  const pollTries = useRef(0);
  useEffect(() => {
    if (!pendingCount || !codes.length) {
      pollTries.current = 0;
      return;
    }
    const t = setInterval(() => {
      pollTries.current += 1;
      if (pollTries.current > 12) {
        clearInterval(t);
        return;
      }
      reload(true);
    }, 10000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCount, codes.length]);

  async function restore() {
    setClaimErr(null);
    const v = claimIn.trim().toUpperCase();
    if (!v) {
      setClaimErr("Enter a key first.");
      return;
    }
    if (codes.includes(v)) {
      setClaimErr("You already hold that key on this device.");
      return;
    }
    try {
      const { posts: hits, engaged: engagedHits } = await api.claim(v);
      // This browser's own key never posted or engaged with anything — the
      // key you're restoring is the one that actually matters, so make it
      // primary instead of leaving "Your key" pointing at an empty one.
      const promote = !primaryOwnsAny && (hits.length > 0 || engagedHits.length > 0);
      setClaimIn("");
      // Adding the code changes `codes`, which the reload effect above is
      // keyed on — it re-fetches and re-merges every held key, this one
      // included, so the merge itself happens there, not here.
      addCode(v, promote);
    } catch (e) {
      setClaimErr(e instanceof Error ? e.message : "No posts found under that key.");
    }
  }

  function keyFor(id: string): string | null {
    return mine.ownerKeyFor(id) || key || null;
  }

  async function del(id: string) {
    const k = keyFor(id);
    if (!k) return;
    try {
      await api.deletePost(id, k);
      setPosts((cur) => cur.filter((p) => p.id !== id));
    } catch {
      /* ignore */
    }
  }

  async function cancelPending(id: string) {
    setActionErr(null);
    const k = keyFor(id);
    if (!k) return;
    setBusyId(id);
    try {
      await api.deletePost(id, k);
      setPosts((cur) => cur.filter((p) => p.id !== id));
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : "Could not cancel that draft.");
    } finally {
      setBusyId(null);
    }
  }

  async function resume(id: string) {
    setActionErr(null);
    const k = keyFor(id);
    if (!k) return;
    setBusyId(id);
    try {
      const res = await api.resumePayment(id, k);
      if (!res.cashfree) {
        setActionErr("Payments aren't available on this deployment right now.");
        setBusyId(null);
        return;
      }
      await openCashfreeCheckout({
        paymentSessionId: res.cashfree.paymentSessionId,
        mode: res.cashfree.mode,
        orderId: res.order.id,
        onSuccess: async ({ orderId }) => {
          try {
            await api.confirmPayment(id, { orderId });
          } catch {
            /* the webhook still catches it either way */
          }
          setBusyId(null);
          reload(true);
        },
        onDismiss: () => setBusyId(null),
      });
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : "Could not resume that payment.");
      setBusyId(null);
    }
  }

  function copyLink(id: string) {
    const url = `${window.location.origin}/#p=${id}`;
    navigator.clipboard?.writeText(url).catch(() => {});
  }

  return (
    <div className="page">
      <h2>My posts</h2>
      <p>
        Everything you have posted — and everything you have voted on or reacted to — on this device or any other, brought together by one key.
        Nothing here is visible to anyone else and nothing is linked to your name.
      </p>

      {paymentNotice && (
        <div className="nt w show" role="status" style={{ marginBottom: 16 }}>
          {paymentNotice}
        </div>
      )}

      {freshIds.size > 0 && (
        <div className="nt w show" role="status" style={{ marginBottom: 16 }}>
          {freshIds.size === 1 ? "One thing you're watching has an outcome now" : `${freshIds.size} things you're watching have outcomes now`} —
          look for the highlighted card below.
        </div>
      )}

      <div className="keybox">
        <div className="kl">Your key — the same for every post, vote and reaction you make</div>
        <div className="krow">
          <span className="kcode">{key || "—"}</span>
          <button
            className="btn gh"
            onClick={async () => {
              const k = key || ensure();
              await navigator.clipboard?.writeText(k).catch(() => {});
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            }}
          >
            {copied ? "Copied" : "Copy key"}
          </button>
        </div>
        <p className="kwhy">
          Save this somewhere. Enter it on another phone or browser and everything you have posted, voted on and reacted to comes back. We cannot
          recover it for you — we do not know who you are. Anyone holding it controls your activity, so treat it like a password, not a username.
        </p>
        {codes.length > 1 && <div className="kextra">Also holding: {codes.slice(1).join(", ")}</div>}
      </div>

      <div className="claimbox">
        <label>Posted, voted or reacted from another device? Enter that key to bring it all here</label>
        <div className="claimrow">
          <input placeholder="UN-XXXXX" maxLength={10} value={claimIn} onChange={(e) => setClaimIn(e.target.value)} />
          <button className="btn gh" onClick={restore}>
            Restore posts
          </button>
        </div>
        {claimErr && <div className="rerr show">{claimErr}</div>}
      </div>

      {actionErr && <div className="rerr show">{actionErr}</div>}

      <div>
        {loading ? (
          <div className="sk">
            <div className="c1">
              <i style={{ height: 24 }} />
            </div>
          </div>
        ) : posts.length ? (
          posts.map((p) => (
            <div className="mine-row" key={p.id} style={freshIds.has(p.id) ? { outline: "2px solid #F59E0B" } : undefined}>
              <p className="mt">
                {p.text.slice(0, 120)}
                {p.text.length > 120 ? "…" : ""}
              </p>
              <div className="mm">
                <span>{p.category}</span>
                <span>{ago(p.at)}</span>
                <span>{nf(rsum(p))} reactions</span>
                {p.type === "dilemma" && <span>{nf(vsum(p))} votes</span>}
                {p.status === "pending_payment" && <span>processing payment — checking every few seconds</span>}
                {p.outcome && <span>outcome posted</span>}
              </div>
              <div className="acts">
                {p.status === "pending_payment" ? (
                  <>
                    <button disabled={busyId === p.id} onClick={() => resume(p.id)}>
                      {busyId === p.id ? "Opening…" : "Resume payment"}
                    </button>
                    <button disabled={busyId === p.id} style={{ color: "#B91C1C" }} onClick={() => cancelPending(p.id)}>
                      Cancel draft
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => router.push("/#p=" + p.id)}>Open</button>
                    <button onClick={() => copyLink(p.id)}>Copy link</button>
                    <button style={{ color: "#B91C1C" }} onClick={() => del(p.id)}>
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="empt">
            <p>Nothing posted with this key yet.</p>
          </div>
        )}
      </div>

      <div style={{ marginTop: 32 }}>
        <h3 style={{ fontSize: 15, marginBottom: 4 }}>Things you voted on or reacted to</h3>
        <p style={{ fontSize: 13, color: "var(--dim)", marginTop: 0, marginBottom: 12 }}>
          Posts someone else wrote, that you weighed in on — not yours to edit or delete, just to watch.
        </p>
        {engaged.length ? (
          engaged.map((p) => (
            <div className="mine-row" key={p.id} style={freshIds.has(p.id) ? { outline: "2px solid #F59E0B" } : undefined}>
              <p className="mt">
                {p.text.slice(0, 120)}
                {p.text.length > 120 ? "…" : ""}
              </p>
              <div className="mm">
                <span>{p.category}</span>
                <span>{ago(p.at)}</span>
                {p.yourVote && p.type === "dilemma" && <span>You voted: {p.yourVote === "a" ? p.oa : p.ob}</span>}
                {p.yourReactions && p.yourReactions.length > 0 && (
                  <span>You reacted: {p.yourReactions.map((r) => CHIP_EMOJI[r] ?? r).join(" ")}</span>
                )}
                {p.outcome && <span>outcome posted</span>}
              </div>
              <div className="acts">
                <button onClick={() => router.push("/#p=" + p.id)}>Open</button>
                <button onClick={() => copyLink(p.id)}>Copy link</button>
              </div>
            </div>
          ))
        ) : (
          <div className="empt">
            <p>Nothing voted on or reacted to with this key yet.</p>
          </div>
        )}
      </div>

      <ShareStudioModal
        open={shareOpen}
        data={shareData}
        initialVariant={shareVariant}
        initialFormat={shareFormat}
        onClose={() => setShareOpen(false)}
      />
    </div>
  );
}
