"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useOwnerKey } from "@/app/hooks/useOwnerKey";
import { api } from "@/app/lib-client/api";
import { ago, nf, rsum, vsum } from "@/lib/board-helpers";
import type { Post } from "@/lib/types";

export default function MinePage() {
  const router = useRouter();
  const { key, codes, ensure, addCode } = useOwnerKey();
  const [posts, setPosts] = useState<(Post & { status: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimIn, setClaimIn] = useState("");
  const [claimErr, setClaimErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    ensure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!key) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const { posts } = await api.claim(key);
        if (!cancelled) setPosts(posts);
      } catch {
        if (!cancelled) setPosts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [key]);

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
      addCode(v);
      setClaimIn("");
      setPosts((cur) => [...hits, ...cur.filter((p) => !hits.some((h) => h.id === p.id))]);
    } catch (e) {
      setClaimErr(e instanceof Error ? e.message : "No posts found under that key.");
    }
  }

  async function del(id: string) {
    if (!key) return;
    try {
      await api.deletePost(id, key);
      setPosts((cur) => cur.filter((p) => p.id !== id));
    } catch {
      /* ignore */
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
                {p.status === "pending_payment" && <span>processing payment</span>}
                {p.outcome && <span>outcome posted</span>}
              </div>
              <div className="acts">
                <button onClick={() => router.push("/#p=" + p.id)}>Open</button>
                <button onClick={() => copyLink(p.id)}>Copy link</button>
                <button style={{ color: "#B91C1C" }} onClick={() => del(p.id)}>
                  Delete
                </button>
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
