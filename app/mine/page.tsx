"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useOwnerKey } from "@/app/hooks/useOwnerKey";
import { useMine } from "@/app/hooks/useMine";
import { api } from "@/app/lib-client/api";
import { openCashfreeCheckout } from "@/app/lib-client/cashfreeCheckout";
import { ago, nf, rsum, vsum } from "@/lib/board-helpers";
import type { Post } from "@/lib/types";

export default function MinePage() {
  const router = useRouter();
  const { key, codes, ensure, addCode } = useOwnerKey();
  const mine = useMine();
  const [posts, setPosts] = useState<(Post & { status: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimIn, setClaimIn] = useState("");
  const [claimErr, setClaimErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);

  useEffect(() => {
    ensure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function reload(silent = false) {
    if (!key) {
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    try {
      const { posts } = await api.claim(key);
      posts.forEach((p) => {
        mine.addMine(p.id);
        mine.recordOwner(p.id, key);
      });
      setPosts(posts);
    } catch {
      if (!silent) setPosts([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    reload(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // A payment that's still "processing" — because the tab was closed before
  // the webhook landed, or a resume happened elsewhere — used to just sit
  // there forever unless you manually refreshed. Quietly re-check for you
  // while any post is in that state, instead of making that your job.
  const pendingCount = posts.filter((p) => p.status === "pending_payment").length;
  const pollTries = useRef(0);
  useEffect(() => {
    if (!pendingCount || !key) {
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
  }, [pendingCount, key]);

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
      const { posts: hits } = await api.claim(v);
      hits.forEach((p) => {
        mine.addMine(p.id);
        mine.recordOwner(p.id, v);
      });
      addCode(v);
      setClaimIn("");
      setPosts((cur) => [...hits, ...cur.filter((p) => !hits.some((h) => h.id === p.id))]);
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
      <p>Everything you have posted, on this device or any other, brought together by one key. Nothing here is visible to anyone else and nothing is linked to your name.</p>

      <div className="keybox">
        <div className="kl">Your key — the same for every post you make</div>
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
          Save this somewhere. Enter it on another phone or browser and every post you have made comes back. We cannot recover it for you — we do
          not know who you are. Anyone holding it controls your posts, so treat it like a password, not a username.
        </p>
        {codes.length > 1 && <div className="kextra">Also holding: {codes.slice(1).join(", ")}</div>}
      </div>

      <div className="claimbox">
        <label>Posted from another device? Enter that key to bring those posts here</label>
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
            <div className="mine-row" key={p.id}>
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
    </div>
  );
}
