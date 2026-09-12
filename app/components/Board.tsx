"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CATS,
  SORTS,
  ago,
  cc,
  eng,
  floorBidBase,
  heat,
  isFresh,
  isGlow,
  nf,
  needsVotes,
  outbidOf,
  rupee,
  shareText,
  shelfOf,
  tvars,
  vsum,
} from "@/lib/board-helpers";
import type { Post } from "@/lib/types";
import { api } from "@/app/lib-client/api";
import { useCurrency } from "@/app/hooks/useCurrency";
import { useMine } from "@/app/hooks/useMine";
import { useOwnerKey } from "@/app/hooks/useOwnerKey";
import PostCard from "./PostCard";
import { EmptySlot, PinCard } from "./PinCard";
import Carousel from "./Carousel";
import PostModal from "./PostModal";
import DetailModal from "./DetailModal";
import VoteModal from "./VoteModal";

const PER = 20;
const SLOTS = 5;

function dayKey(): string {
  const d = new Date();
  return `unsaid_voted_${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export default function Board() {
  const { code: curCode, def: curDef } = useCurrency();
  const mine = useMine();
  const { key: ownerKey, ensure } = useOwnerKey();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [cat, setCat] = useState("all");
  const [win, setWin] = useState<"today" | "all">("today");
  const [sort, setSort] = useState<"trending" | "new" | "needy">("trending");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const [postModal, setPostModal] = useState<{ open: boolean; type: "confession" | "dilemma"; wantPin: boolean }>({
    open: false,
    type: "confession",
    wantPin: false,
  });
  const [detailId, setDetailId] = useState<string | null>(null);
  const [voteOpen, setVoteOpen] = useState(false);
  const [savedInfo, setSavedInfo] = useState<{ code: string; kind: string } | null>(null);
  const [votedToday, setVotedToday] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const { posts } = await api.listPosts();
      setPosts(posts);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The board didn't load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15000);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    try {
      setVotedToday(Number(localStorage.getItem(dayKey()) || 0));
    } catch {
      /* ignore */
    }
  }, []);
  const bumpVotedToday = () => {
    setVotedToday((v) => {
      const nv = v + 1;
      try {
        localStorage.setItem(dayKey(), String(nv));
      } catch {
        /* ignore */
      }
      return nv;
    });
  };

  // open a post from a #p=id permalink
  useEffect(() => {
    const openFromHash = () => {
      const h = (window.location.hash || "").replace(/^#/, "");
      if (h.startsWith("p=")) setDetailId(h.slice(2));
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

  const all = posts;
  // Recomputed whenever the post list refreshes (every 15s) rather than on
  // every render, so "now" here isn't read impurely during render.
  const now = useMemo(() => Date.now(), [posts]);
  const cut = useMemo(() => {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, [now]);
  let pool = win === "today" ? all.filter((p) => p.at > cut) : all;
  if (!pool.length) pool = all;
  const base = query ? all : pool;
  let view = cat === "all" ? base : base.filter((p) => p.category === cat);
  if (query) {
    const q = query.trim().toLowerCase();
    view = view.filter((p) => (p.text + " " + (p.oa || "") + " " + (p.ob || "") + " " + p.category).toLowerCase().includes(q));
  }

  const passes = useCallback(
    (p: Post) => (sort === "new" ? isFresh(p) : sort === "needy" ? needsVotes(mine.votedIds)(p) : true),
    [sort, mine.votedIds]
  );
  const orderOf = useCallback(
    (arr: Post[]) =>
      sort === "new"
        ? [...arr].sort((a, b) => b.at - a.at)
        : sort === "needy"
        ? [...arr].sort((a, b) => eng(a) - eng(b))
        : [...arr].sort((a, b) => heat(b) - heat(a)),
    [sort]
  );

  const shelfAll = shelfOf(all);
  const shelf = shelfAll.filter(passes);
  const bumped = outbidOf(all);
  const floorBase = floorBidBase(all, curCode);

  const glowAll = view.filter(isGlow);
  const glows = orderOf(glowAll.filter(passes));
  const shelfIds = new Set(shelfAll.map((p) => p.id));
  const restAll = view.filter((p) => !shelfIds.has(p.id) && !isGlow(p));
  const rest = orderOf(restAll.filter(passes));

  const freshN = restAll.filter(isFresh).length + glowAll.filter(isFresh).length;
  const needyN = restAll.filter(needsVotes(mine.votedIds)).length + glowAll.filter(needsVotes(mine.votedIds)).length;

  let list: Post[];
  if (sort === "trending") {
    const f = rest.filter(isFresh).sort((a, b) => b.at - a.at);
    list = [...f, ...rest.filter((p) => !isFresh(p))];
  } else list = rest;

  const heroPosts = useMemo(() => {
    const dilemmas = all.filter((p) => p.type === "dilemma" && vsum(p) > 0);
    const scored = dilemmas
      .map((p) => {
        const t = vsum(p);
        const closeness = 1 - Math.abs(p.va - p.vb) / t; // 1 = perfect 50/50 tie, favors close calls
        return { p, score: closeness * 100 + Math.min(40, heat(p)) };
      })
      .sort((a, b) => b.score - a.score)
      .map((s) => s.p);

    let chosen = scored.slice(0, 12);
    if (chosen.length < 10) {
      const chosenIds = new Set(chosen.map((p) => p.id));
      const rest = [...all].filter((p) => !chosenIds.has(p.id)).sort((a, b) => heat(b) - heat(a));
      chosen = [...chosen, ...rest.slice(0, 10 - chosen.length)];
    }
    return chosen;
  }, [all]);

  const st = page * PER;
  const slice = list.slice(st, st + PER);
  const pages = Math.max(1, Math.ceil(list.length / PER));

  const voteQueue = useMemo(
    () => all.filter((p) => p.type === "dilemma" && !mine.votedIds.has(p.id)).sort((a, b) => vsum(a) - vsum(b) || heat(b) - heat(a)),
    [all, mine.votedIds]
  );

  function openM(type: "confession" | "dilemma", wantPin = false) {
    setPostModal({ open: true, type, wantPin });
  }
  function openDetail(id: string) {
    setDetailId(id);
    window.history.replaceState(null, "", "#p=" + id);
  }
  function closeDetail() {
    setDetailId(null);
    window.history.replaceState(null, "", window.location.pathname);
  }

  async function handleVote(id: string, side: "a" | "b") {
    const { va, vb, alreadyVoted } = await api.vote(id, side);
    if (!alreadyVoted) {
      mine.recordVote(id, side);
      bumpVotedToday();
      setPosts((cur) => cur.map((p) => (p.id === id ? { ...p, va, vb } : p)));
    }
    return { va, vb };
  }
  async function handleReact(id: string, key: string) {
    if (mine.hasReacted(id, key)) return;
    const { reactions } = await api.react(id, key);
    mine.recordReaction(id, key);
    setPosts((cur) => cur.map((p) => (p.id === id ? { ...p, reactions } : p)));
  }
  async function handleReport(id: string) {
    const { hidden } = await api.report(id);
    if (hidden) setPosts((cur) => cur.filter((p) => p.id !== id));
  }
  async function handleShare(p: Post) {
    const text = shareText(p);
    const url = `${window.location.origin}${window.location.pathname}#p=${p.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ text, url });
        return;
      } catch {
        /* fall through to clipboard */
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
    } catch {
      /* ignore */
    }
  }
  function copyLink(id: string) {
    const url = `${window.location.origin}${window.location.pathname}#p=${id}`;
    navigator.clipboard?.writeText(url).catch(() => {});
  }

  const detailPost = detailId ? all.find((p) => p.id === detailId) || null : null;
  const detailOnShelf = detailPost ? shelfAll.some((p) => p.id === detailPost.id) : false;

  return (
    <div id="vBoard">
      <section className="hero">
        {!heroPosts.length ? (
          <>
            <span className="h-tag">
              <span className="pulse" />
              The board is open
            </span>
            <h2 className="h-q">Say the thing you can&apos;t say anywhere else.</h2>
            <p className="h-sub">Post a confession, or hand strangers a decision you&apos;re stuck on and let them settle it. Anonymous, always.</p>
          </>
        ) : (
          <Carousel trackClassName="heroTrack" count={heroPosts.length} autoAdvanceMs={6000} ariaLabel="Trending posts">
            {heroPosts.map((p) => {
              const t = vsum(p);
              const pa = t ? Math.round((p.va / t) * 100) : 50;
              const margin = Math.abs(pa - (100 - pa));
              const votedSide = mine.votedSide(p.id);
              return (
                <div className="heroSlide" key={p.id} style={tvars(p)}>
                  <span className="h-tag">
                    <span className="pulse" />
                    {p.type === "dilemma"
                      ? (margin <= 6 ? "Neck and neck · " : "Trending now · ") + nf(t) + " votes"
                      : "Trending now · " + nf(eng(p)) + " reactions"}
                  </span>
                  <h2
                    className="h-q"
                    style={p.type === "confession" ? { fontStyle: "italic" } : undefined}
                    onClick={() => openDetail(p.id)}
                  >
                    {p.type === "confession" ? `“${p.text}”` : p.text}
                  </h2>
                  {p.type === "dilemma" && (
                    <div className="heroBar">
                      <div className="blab">
                        <span>{p.oa}</span>
                        <span className="r">{p.ob}</span>
                      </div>
                      <div className={"bar" + (votedSide ? " done" : "")}>
                        <button
                          className="sd a"
                          style={{ flexBasis: (votedSide ? pa : 50) + "%" }}
                          disabled={!!votedSide}
                          onClick={() => handleVote(p.id, "a")}
                        >
                          {votedSide ? pa + "%" + (votedSide === "a" ? " · yours" : "") : pa + "%"}
                        </button>
                        <button
                          className="sd b"
                          style={{ flexBasis: (votedSide ? 100 - pa : 50) + "%" }}
                          disabled={!!votedSide}
                          onClick={() => handleVote(p.id, "b")}
                        >
                          {votedSide ? (votedSide === "b" ? "yours · " : "") + (100 - pa) + "%" : 100 - pa + "%"}
                        </button>
                      </div>
                    </div>
                  )}
                  <button className="heroOpen" onClick={() => openDetail(p.id)}>
                    See full post →
                  </button>
                </div>
              );
            })}
          </Carousel>
        )}
        <div className="h-cta">
          <button className="cta cta-a" onClick={() => openM("confession")}>
            <span className="ct">Confess something</span>
            <span className="cs">Nobody will know it was you.</span>
          </button>
          <button className="cta cta-b" onClick={() => openM("dilemma")}>
            <span className="ct">Let strangers decide</span>
            <span className="cs">Two options. They pick. You live with it.</span>
          </button>
          <button className="cta cta-c" onClick={() => setVoteOpen(true)}>
            <span className="ct">Start voting</span>
            <span className="cs">Judge other people&apos;s lives instead.</span>
          </button>
        </div>
      </section>

      <div className="ctrl">
        <div className="crow">
          <div className="cats">
            {CATS.map(([key, label]) => (
              <button key={key} className={cat === key ? "on" : ""} style={{ ["--cc" as string]: cc(key).a }} onClick={() => { setCat(key); setPage(0); }}>
                {label}
              </button>
            ))}
          </div>
          <button className="votebtn" onClick={() => setVoteOpen(true)}>
            Start voting
          </button>
        </div>
        <div className="crow crow2">
          <div className="sorts">
            {SORTS.map(([key, label]) => {
              const n = key === "new" ? freshN : key === "needy" ? needyN : 0;
              return (
                <button key={key} className={sort === key ? "on" : ""} onClick={() => { setSort(key as typeof sort); setPage(0); }}>
                  {label}
                  {n > 0 && <span className="cnt-b">{nf(n)}</span>}
                </button>
              );
            })}
          </div>
          <div className="cright">
            <div className="seg">
              <button className={win === "today" ? "on" : ""} onClick={() => { setWin("today"); setPage(0); }}>
                Today
              </button>
              <button className={win === "all" ? "on" : ""} onClick={() => { setWin("all"); setPage(0); }}>
                All time
              </button>
            </div>
            <input className="search" type="search" placeholder="Search the board" aria-label="Search posts" value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} />
          </div>
        </div>
      </div>

      <div>
        {mine.myIds
          .map((id) => all.find((p) => p.id === id))
          .filter((p): p is Post => !!p)
          .slice(0, 3)
          .flatMap((p) => {
            const banners: React.ReactNode[] = [];
            if (p.tier === "pin" && p.paid && !shelfIds.has(p.id) && !mine.seenOutbid.includes(p.id)) {
              banners.push(
                <div className="banner ob" key={p.id + "-ob"}>
                  <span>
                    Your {rupee(p.paid, curCode)} bid was beaten — you are off the shelf. {rupee(floorBase, curCode)} puts you back on.
                  </span>
                  <span className="sp" />
                  <button onClick={() => openM("confession", true)}>Bid again</button>
                  <button style={{ background: "transparent", color: "inherit" }} onClick={() => mine.dismissOutbid(p.id)}>
                    Dismiss
                  </button>
                </div>
              );
            }
            if (p.type === "dilemma" && !p.outcome && vsum(p) > 0 && now - p.at > 2 * 3600 * 1000) {
              banners.push(
                <div className="banner rs" key={p.id + "-rs"}>
                  <span>{nf(vsum(p))} strangers voted on your dilemma. Tell them what you actually did.</span>
                  <span className="sp" />
                  <button onClick={() => openDetail(p.id)}>Write the outcome</button>
                </div>
              );
            }
            return banners;
          })}
      </div>

      {error && (
        <div className="err-banner">
          {error}{" "}
          <button className="lnk" onClick={refresh}>
            Try again
          </button>
        </div>
      )}

      <div className="layout">
        <aside className="side">
          <div className="rail">
            <button className="railvote" onClick={() => setVoteOpen(true)}>
              Start voting
            </button>
            <div className="side-lbl">Sort</div>
            <div className="sorts">
              {SORTS.map(([key, label]) => (
                <button key={key} className={sort === key ? "on" : ""} onClick={() => { setSort(key as typeof sort); setPage(0); }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </aside>
        <div className="main">
          <div>
            <div className="sect">
              <div className="sect-head">
                <h2>
                  <span className="sdot" style={{ background: "#F59E0B" }} />
                  Pinned
                </h2>
                <span className="m">
                  {shelfAll.length} of {SLOTS} slots held{bumped.length ? ` · ${bumped.length} outbid` : ""}
                </span>
              </div>
              <p className="sect-note">
                {sort === "trending"
                  ? shelfAll.length === 0
                    ? `Every slot is open right now. ${rupee(floorBase, curCode)} puts you at #1 for 24 hours.`
                    : shelfAll.length < SLOTS
                    ? `${SLOTS - shelfAll.length} of ${SLOTS} slots still open from ${rupee(floorBase, curCode)}.`
                    : "The five highest bids hold the shelf for 24 hours."
                  : `Showing ${shelf.length} of ${shelfAll.length} pinned that match this filter.`}
              </p>
              {(() => {
                const items =
                  shelf.length || sort === "trending"
                    ? [
                        ...shelf.map((p, i) => <PinCard key={p.id} post={p} index={i} currency={curCode} onOpen={() => openDetail(p.id)} />),
                        ...Array.from({ length: Math.max(0, SLOTS - shelfAll.length) }, (_, i) => (
                          <EmptySlot key={"empty" + i} n={shelfAll.length + i + 1} price={floorBase} currency={curCode} onClick={() => openM("confession", true)} />
                        )),
                      ]
                    : [
                        <div className="slot-empty" style={{ cursor: "default" }} key="none">
                          <b>None</b>
                          <span>No pinned posts match this filter</span>
                        </div>,
                      ];
                return (
                  <Carousel trackClassName="shelf" count={items.length} ariaLabel="Pinned posts">
                    {items}
                  </Carousel>
                );
              })()}
            </div>
            <div className="divider" />
          </div>

          {(glows.length > 0 || (sort === "trending" && glowAll.length > 0)) && (
            <>
              <div className="sect">
                <div className="sect-head">
                  <h2>
                    <span className="sdot" style={{ background: "#8B5CF6" }} />
                    Highlighted
                  </h2>
                  <span className="m">
                    {sort === "trending" ? glowAll.length + " live" : glows.length + " of " + glowAll.length + " match"} · {curDef.sym}
                    {curDef.glow} each
                  </span>
                </div>
                <p className="sect-note">Paid for a card above the board for 24 hours.</p>
                <div className="feed">
                  {glows.map((p) => (
                    <PostCard
                      key={p.id}
                      post={p}
                      rank={null}
                      votedSide={mine.votedSide(p.id)}
                      reactedKeys={[]}
                      onOpen={() => openDetail(p.id)}
                      onVote={(side) => handleVote(p.id, side)}
                      onReact={(key) => handleReact(p.id, key)}
                      onShare={() => handleShare(p)}
                      onReport={() => handleReport(p.id)}
                    />
                  ))}
                </div>
              </div>
              <div className="divider" />
            </>
          )}

          <div className="sect" id="boardSect">
            <div className="sect-head">
              <h2>
                <span className="sdot" style={{ background: "var(--ink)" }} />
                The board
              </h2>
              <span className="m">
                {nf(rest.length)} {rest.length === 1 ? "post" : "posts"}
                {win === "today" ? " today" : ""}
              </span>
            </div>
            <p className="sect-note">
              {sort === "new"
                ? "Newest first. Fresh posts land here the moment they are paid for."
                : sort === "needy"
                ? "Barely any votes yet. These are the ones that need you."
                : "Rising fastest right now — and anything posted in the last two hours rides on top."}
            </p>
            <div className="feed">
              {loading ? (
                <div className="sk">
                  <div className="c1">
                    <i style={{ height: 24 }} />
                  </div>
                  <div className="c2">
                    <i />
                    <i />
                    <i />
                  </div>
                </div>
              ) : slice.length ? (
                slice.map((p, i) => (
                  <PostCard
                    key={p.id}
                    post={p}
                    rank={sort === "trending" ? st + i + 1 : null}
                    votedSide={mine.votedSide(p.id)}
                    reactedKeys={[]}
                    onOpen={() => openDetail(p.id)}
                    onVote={(side) => handleVote(p.id, side)}
                    onReact={(key) => handleReact(p.id, key)}
                    onShare={() => handleShare(p)}
                    onReport={() => handleReport(p.id)}
                  />
                ))
              ) : (
                <div className="empt">
                  <p>
                    {sort !== "trending" && restAll.length
                      ? sort === "new"
                        ? "Nothing has been posted in the last two hours."
                        : "Every post here already has plenty of votes."
                      : cat !== "all"
                      ? `Nothing in ${cat} yet.`
                      : "Nobody has said anything yet."}
                  </p>
                  <button className="btn gh" onClick={() => (cat !== "all" ? setCat("all") : openM("confession"))}>
                    {cat !== "all" ? "See everything instead" : "Be the first to post"}
                  </button>
                </div>
              )}
            </div>
          </div>
          {list.length > PER && (
            <div className="pag">
              <span>
                {st + 1} – {Math.min(st + PER, list.length)} of {nf(list.length)}
              </span>
              <span className="pb">
                <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </button>
                <button disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>
                  Next
                </button>
              </span>
            </div>
          )}
        </div>
      </div>

      <PostModal
        open={postModal.open}
        initialType={postModal.type}
        wantPin={postModal.wantPin}
        posts={all}
        currency={curDef}
        onClose={() => setPostModal((m) => ({ ...m, open: false }))}
        onPosted={({ postId, ownerKey: ok, type }) => {
          mine.addMine(postId);
          setPostModal((m) => ({ ...m, open: false }));
          setSavedInfo({ code: ok, kind: type });
          refresh();
        }}
      />

      <DetailModal
        post={detailPost}
        isMine={detailPost ? mine.isMine(detailPost.id) : false}
        ownerKey={ownerKey}
        onShelf={detailOnShelf}
        currency={curCode}
        votedSide={detailPost ? mine.votedSide(detailPost.id) : undefined}
        reactedKeys={[]}
        onClose={closeDetail}
        onVote={(side) => detailPost && handleVote(detailPost.id, side)}
        onReact={(key) => detailPost && handleReact(detailPost.id, key)}
        onReport={() => detailPost && handleReport(detailPost.id)}
        onDeleted={() => {
          if (detailPost) setPosts((cur) => cur.filter((p) => p.id !== detailPost.id));
          closeDetail();
        }}
        onOutcomePosted={(outcome) => {
          if (detailPost) setPosts((cur) => cur.map((p) => (p.id === detailPost.id ? { ...p, outcome } : p)));
        }}
        onShare={() => detailPost && handleShare(detailPost)}
        onCopyLink={() => detailPost && copyLink(detailPost.id)}
      />

      <VoteModal open={voteOpen} queue={voteQueue} votedToday={votedToday} onClose={() => { setVoteOpen(false); refresh(); }} onVote={handleVote} />

      {savedInfo && (
        <div className="ov show" onClick={(e) => e.target === e.currentTarget && setSavedInfo(null)}>
          <div className="md succ" role="dialog" aria-modal="true">
            <h3>Posted.</h3>
            <p>Your {savedInfo.kind} is live. Save your key to manage it from any device.</p>
            <div className="succ codebig">{savedInfo.code}</div>
            <p className="succ why">
              Anyone holding this key controls your posts. We can&apos;t recover it for you — we don&apos;t know who you are.
            </p>
            <div className="ma">
              <button className="btn gh" onClick={() => setSavedInfo(null)}>
                Close
              </button>
              <button
                className="btn"
                onClick={() => {
                  navigator.clipboard?.writeText(savedInfo.code).catch(() => {});
                }}
              >
                Copy key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
