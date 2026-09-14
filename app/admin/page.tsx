"use client";
import { useEffect, useState, useMemo } from "react";

interface ReportRow {
  id: string;
  type: string;
  category: string;
  text: string;
  option_a: string | null;
  option_b: string | null;
  reports: number;
  hidden: boolean;
  deleted_by_author: boolean;
  created_at: string;
  tier: string;
  currency: string;
  paid_amount_minor: number | null;
  status: string;
}

interface Summary {
  liveCount: number;
  pendingCount: number;
  reportedCount: number;
  paidOrderCount: number;
  last24hPaidCount: number;
  revenueByCurrency: Record<string, number>;
}

interface VisitorItem {
  deviceId: string;
  displayId: string;
  deviceType: "mobile" | "desktop" | "tablet";
  os: string;
  browser: string;
  label: string;
  icon: string;
  firstSeenAt: string;
  lastSeenAt: string;
  visitCount: number;
  isPaid: boolean;
  totalPaidMinor: number;
  totalPaid: string;
  currency: string;
  postsCount: number;
  paidPostsCount: number;
  votesCount: number;
  reactionsCount: number;
  postTiers?: string[];
  hasPinned?: boolean;
  hasBoosted?: boolean;
  hasNormal?: boolean;
}

interface VisitorsMetrics {
  totalVisitors: number;
  paidVisitors: number;
  conversionRate: string;
  totalRevenueMinor: number;
  totalRevenueFormatted: string;
  desktopCount: number;
  mobileCount: number;
  totalVotesCount: number;
  totalReactionsCount: number;
}

interface AdminOrderItem {
  id: string;
  postId: string;
  postText: string;
  category: string;
  tier: string;
  amountMinor: number;
  amountFormatted: string;
  currency: string;
  status: "paid" | "created" | "failed";
  gateway: string;
  paymentId: string | null;
  createdAt: string;
  paidAt: string | null;
}

interface AdminPostItem {
  id: string;
  type: string;
  category: string;
  text: string;
  option_a: string | null;
  option_b: string | null;
  votes_a: number;
  votes_b: number;
  totalVotes: number;
  tier: "pin" | "glow" | "std";
  status: string;
  hidden: boolean;
  isPaid: boolean;
  paidAmountMinor: number;
  paidAmountFormatted: string;
  currency: string;
  createdAt: string;
  paidAt: string | null;
}

type AdminTab = "visitors" | "posts" | "orders" | "reports" | "tools";
type DateFilter = "all" | "today" | "7d" | "30d";
type TierFilter = "all" | "pin" | "glow" | "std";
type PaidFilter = "all" | "paid" | "free";

function matchesDate(dateStr: string | null | undefined, filter: DateFilter): boolean {
  if (filter === "all") return true;
  if (!dateStr) return false;
  const d = new Date(dateStr).getTime();
  if (isNaN(d)) return false;
  const now = Date.now();
  if (filter === "today") return now - d <= 24 * 3600 * 1000;
  if (filter === "7d") return now - d <= 7 * 24 * 3600 * 1000;
  if (filter === "30d") return now - d <= 30 * 24 * 3600 * 1000;
  return true;
}

function formatRelativeTime(isoStr?: string | null) {
  if (!isoStr) return "—";
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return "—";
    const diffMs = Date.now() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>("visitors");

  // Data states
  const [visitors, setVisitors] = useState<VisitorItem[]>([]);
  const [metrics, setMetrics] = useState<VisitorsMetrics | null>(null);
  const [posts, setPosts] = useState<AdminPostItem[]>([]);
  const [orders, setOrders] = useState<AdminOrderItem[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);

  // Visitor Filters
  const [vPaid, setVPaid] = useState<PaidFilter>("all");
  const [vDate, setVDate] = useState<DateFilter>("all");
  const [vTier, setVTier] = useState<TierFilter>("all");
  const [vDevice, setVDevice] = useState<"all" | "mobile" | "desktop">("all");
  const [vSearch, setVSearch] = useState("");

  // Post Filters
  const [pPaid, setPPaid] = useState<PaidFilter>("all");
  const [pDate, setPDate] = useState<DateFilter>("all");
  const [pTier, setPTier] = useState<TierFilter>("all");
  const [pCategory, setPCategory] = useState("all");
  const [pSearch, setPSearch] = useState("");
  const [pSort, setPSort] = useState<"newest" | "votes" | "revenue">("newest");

  // Order Filters
  const [oStatus, setOStatus] = useState<"all" | "paid" | "created">("all");
  const [oDate, setODate] = useState<DateFilter>("all");
  const [oTier, setOTier] = useState<TierFilter>("all");
  const [oSearch, setOSearch] = useState("");

  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Recovery & Purge tool states
  const [recPostId, setRecPostId] = useState("");
  const [recOwnerKey, setRecOwnerKey] = useState("");
  const [recMsg, setRecMsg] = useState<string | null>(null);
  const [recBusy, setRecBusy] = useState(false);
  const [purgeMsg, setPurgeMsg] = useState<string | null>(null);
  const [purgeBusy, setPurgeBusy] = useState(false);
  const [purgeArmed, setPurgeArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  async function loadAllData() {
    setLoadingData(true);
    try {
      const [rRep, rSum, rVis, rOrd, rPost] = await Promise.all([
        fetch("/api/admin/reports"),
        fetch("/api/admin/summary"),
        fetch("/api/admin/visitors"),
        fetch("/api/admin/orders"),
        fetch("/api/admin/posts"),
      ]);

      if (rRep.status === 401 || rSum.status === 401) {
        setAuthed(false);
        return;
      }

      setAuthed(true);
      const repData = await rRep.json();
      const sumData = await rSum.json();
      setReports(repData.reports ?? []);
      setSummary(sumData);

      if (rVis.ok) {
        const visData = await rVis.json();
        setVisitors(visData.visitors ?? []);
        setMetrics(visData.metrics ?? null);
      }

      if (rOrd.ok) {
        const ordData = await rOrd.json();
        setOrders(ordData.orders ?? []);
      }

      if (rPost.ok) {
        const postData = await rPost.json();
        setPosts(postData.posts ?? []);
      }
    } catch {
      // Ignore network errors on initial mount
    } finally {
      setLoadingData(false);
    }
  }

  useEffect(() => {
    loadAllData();
  }, []);

  async function login() {
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Wrong password.");
      setAuthed(true);
      loadAllData();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not log in.");
    } finally {
      setBusy(false);
    }
  }

  async function takedown(id: string, action: "hide" | "unhide") {
    await fetch(`/api/admin/posts/${id}/takedown`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    loadAllData();
  }

  async function reassignOwner() {
    setRecMsg(null);
    setRecBusy(true);
    try {
      const res = await fetch(`/api/admin/posts/${recPostId.trim()}/reassign-owner`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerKey: recOwnerKey.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not reassign.");
      setRecMsg(`Done — ${recPostId.trim()} now belongs to ${recOwnerKey.trim()}.`);
    } catch (e) {
      setRecMsg(e instanceof Error ? e.message : "Could not reassign.");
    } finally {
      setRecBusy(false);
    }
  }

  async function purgeSeedContent() {
    if (!purgeArmed) {
      setPurgeArmed(true);
      setPurgeMsg(null);
      return;
    }
    setPurgeArmed(false);
    setPurgeMsg(null);
    setPurgeBusy(true);
    try {
      const res = await fetch("/api/admin/posts/purge-seed", { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not remove seed content.");
      setPurgeMsg(`Done — hid ${d.hidden} of ${d.total} seeded posts.`);
      loadAllData();
    } catch (e) {
      setPurgeMsg(e instanceof Error ? e.message : "Could not remove seed content.");
    } finally {
      setPurgeBusy(false);
    }
  }

  function copyDeviceId(id: string) {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  // Filtered Visitors
  const filteredVisitors = useMemo(() => {
    return visitors.filter((v) => {
      // Paid filter
      if (vPaid === "paid" && !v.isPaid) return false;
      if (vPaid === "free" && v.isPaid) return false;

      // Date filter (last seen or first seen)
      if (!matchesDate(v.lastSeenAt, vDate)) return false;

      // Tier filter (post version)
      if (vTier === "pin" && !v.hasPinned) return false;
      if (vTier === "glow" && !v.hasBoosted) return false;
      if (vTier === "std" && !v.hasNormal) return false;

      // Device filter
      if (vDevice === "mobile" && v.deviceType !== "mobile") return false;
      if (vDevice === "desktop" && v.deviceType !== "desktop") return false;

      // Search
      if (vSearch.trim()) {
        const q = vSearch.toLowerCase();
        const matchId = v.deviceId.toLowerCase().includes(q) || v.displayId.toLowerCase().includes(q);
        const matchLabel = v.label.toLowerCase().includes(q);
        const matchOs = v.os.toLowerCase().includes(q);
        const matchBrowser = v.browser.toLowerCase().includes(q);
        return matchId || matchLabel || matchOs || matchBrowser;
      }
      return true;
    });
  }, [visitors, vPaid, vDate, vTier, vDevice, vSearch]);

  // Filtered Posts
  const filteredPosts = useMemo(() => {
    const list = posts.filter((p) => {
      // Paid customer filter
      if (pPaid === "paid" && !p.isPaid) return false;
      if (pPaid === "free" && p.isPaid) return false;

      // Date filter
      if (!matchesDate(p.createdAt, pDate)) return false;

      // Post tier / version filter
      if (pTier !== "all" && p.tier !== pTier) return false;

      // Category filter
      if (pCategory !== "all" && p.category.toLowerCase() !== pCategory.toLowerCase()) return false;

      // Search
      if (pSearch.trim()) {
        const q = pSearch.toLowerCase();
        const matchText = p.text.toLowerCase().includes(q);
        const matchCat = p.category.toLowerCase().includes(q);
        const matchId = p.id.toLowerCase().includes(q);
        return matchText || matchCat || matchId;
      }
      return true;
    });

    if (pSort === "votes") {
      list.sort((a, b) => b.totalVotes - a.totalVotes);
    } else if (pSort === "revenue") {
      list.sort((a, b) => b.paidAmountMinor - a.paidAmountMinor);
    } else {
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return list;
  }, [posts, pPaid, pDate, pTier, pCategory, pSearch, pSort]);

  // Unique categories for posts filter
  const postCategories = useMemo(() => {
    const set = new Set<string>();
    posts.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [posts]);

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // Status filter
      if (oStatus !== "all" && o.status !== oStatus) return false;

      // Date filter
      if (!matchesDate(o.paidAt || o.createdAt, oDate)) return false;

      // Post tier filter
      if (oTier !== "all" && o.tier !== oTier) return false;

      // Search
      if (oSearch.trim()) {
        const q = oSearch.toLowerCase();
        const matchId = o.id.toLowerCase().includes(q);
        const matchPost = o.postText.toLowerCase().includes(q);
        const matchGateway = o.gateway.toLowerCase().includes(q);
        return matchId || matchPost || matchGateway;
      }
      return true;
    });
  }, [orders, oStatus, oDate, oTier, oSearch]);

  const paidCount = useMemo(() => visitors.filter((v) => v.isPaid).length, [visitors]);
  const mobileCount = useMemo(() => visitors.filter((v) => v.deviceType === "mobile").length, [visitors]);
  const desktopCount = useMemo(() => visitors.filter((v) => v.deviceType === "desktop").length, [visitors]);

  if (!authed) {
    return (
      <div className="page">
        <div className="admin-login">
          <h2>Admin Console</h2>
          <p>Password-protected. Set ADMIN_PASSWORD in your environment.</p>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
          />
          {err && <div className="rerr show">{err}</div>}
          <button className="btn" onClick={login} disabled={busy}>
            {busy ? "Logging in…" : "Log in"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: 1220, margin: "0 auto", padding: "24px 20px" }}>
      {/* Top Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em" }}>Admin Intelligence & Control</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--dim)" }}>
            Real-time visitor tracking, hardware attribution, post versions, conversion ledger, and moderation.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            className="btn gh"
            onClick={loadAllData}
            disabled={loadingData}
            style={{ fontSize: 12.5, padding: "6px 14px", display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            {loadingData ? "Refreshing…" : "↻ Refresh Live Data"}
          </button>
        </div>
      </div>

      {/* Conversion Funnel & Top Metrics */}
      <div className="admin-card" style={{ padding: "18px 20px", marginBottom: 20 }}>
        <div className="admin-stats">
          <div className="admin-stat">
            <b>{metrics?.totalVisitors ?? visitors.length}</b>
            <span>Unique Visitors</span>
            <div className="stat-sub" style={{ color: "#64748B" }}>
              📱 {metrics?.mobileCount ?? mobileCount} mob · 💻 {metrics?.desktopCount ?? desktopCount} desk
            </div>
          </div>

          <div className="admin-stat">
            <b>{metrics?.paidVisitors ?? paidCount}</b>
            <span>Paid Customers</span>
            <div className="stat-sub" style={{ color: "#10B981" }}>
              {metrics?.conversionRate ?? "0%"} conversion rate
            </div>
          </div>

          <div className="admin-stat">
            <b>{metrics?.totalRevenueFormatted ?? "₹0.00"}</b>
            <span>Total Revenue</span>
            <div className="stat-sub" style={{ color: "#6366F1" }}>
              {(summary?.paidOrderCount ?? 0)} completed orders
            </div>
          </div>

          <div className="admin-stat">
            <b>
              {paidCount > 0 && metrics?.totalRevenueMinor
                ? `₹${((metrics.totalRevenueMinor / paidCount) / 100).toFixed(0)}`
                : "₹0"}
            </b>
            <span>Avg / Paid User (ARPPU)</span>
            <div className="stat-sub" style={{ color: "#0F172A" }}>
              {summary?.last24hPaidCount ?? 0} paid in last 24h
            </div>
          </div>

          <div className="admin-stat">
            <b>{posts.length || (summary?.liveCount ?? 0)}</b>
            <span>Total Confessions</span>
            <div className="stat-sub" style={{ color: summary?.reportedCount ? "#E11D48" : "#64748B" }}>
              {summary?.reportedCount ?? 0} reported · {summary?.pendingCount ?? 0} pending
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="admin-tabs">
        <button
          className={`admin-tab-btn ${activeTab === "visitors" ? "active" : ""}`}
          onClick={() => setActiveTab("visitors")}
        >
          <span>Visitors & Devices</span>
          <span className="admin-tab-badge">{visitors.length}</span>
        </button>

        <button
          className={`admin-tab-btn ${activeTab === "posts" ? "active" : ""}`}
          onClick={() => setActiveTab("posts")}
        >
          <span>Confessions & Posts</span>
          <span className="admin-tab-badge">{posts.length}</span>
        </button>

        <button
          className={`admin-tab-btn ${activeTab === "orders" ? "active" : ""}`}
          onClick={() => setActiveTab("orders")}
        >
          <span>Payment Ledger</span>
          <span className="admin-tab-badge">{orders.length}</span>
        </button>

        <button
          className={`admin-tab-btn ${activeTab === "reports" ? "active" : ""}`}
          onClick={() => setActiveTab("reports")}
        >
          <span>Moderation Queue</span>
          {reports.length > 0 && (
            <span className="admin-tab-badge" style={{ background: "#FEE2E2", color: "#991B1B" }}>
              {reports.length}
            </span>
          )}
        </button>

        <button
          className={`admin-tab-btn ${activeTab === "tools" ? "active" : ""}`}
          onClick={() => setActiveTab("tools")}
        >
          <span>Post Tools & Seed</span>
        </button>
      </div>

      {/* TAB 1: Visitors & Devices */}
      {activeTab === "visitors" && (
        <div className="admin-card">
          {/* Multi-Dimensional Filter Bar */}
          <div className="admin-filter-bar">
            {/* Row 1: Paid Status & Post Version */}
            <div className="admin-filter-row">
              <span className="admin-filter-label">Customer:</span>
              <div className="admin-filter-group">
                <button
                  className={`admin-filter-pill ${vPaid === "all" ? "active" : ""}`}
                  onClick={() => setVPaid("all")}
                >
                  All Visitors ({visitors.length})
                </button>
                <button
                  className={`admin-filter-pill ${vPaid === "paid" ? "active" : ""}`}
                  onClick={() => setVPaid("paid")}
                >
                  💰 Paid Only ({paidCount})
                </button>
                <button
                  className={`admin-filter-pill ${vPaid === "free" ? "active" : ""}`}
                  onClick={() => setVPaid("free")}
                >
                  Free Visitors ({visitors.length - paidCount})
                </button>
              </div>

              <span className="admin-filter-label" style={{ marginLeft: 10 }}>Post Version:</span>
              <div className="admin-filter-group">
                <button
                  className={`admin-filter-pill ${vTier === "all" ? "active" : ""}`}
                  onClick={() => setVTier("all")}
                >
                  All Versions
                </button>
                <button
                  className={`admin-filter-pill ${vTier === "pin" ? "active" : ""}`}
                  onClick={() => setVTier("pin")}
                >
                  👑 Pinned
                </button>
                <button
                  className={`admin-filter-pill ${vTier === "glow" ? "active" : ""}`}
                  onClick={() => setVTier("glow")}
                >
                  ⚡ Boosted
                </button>
                <button
                  className={`admin-filter-pill ${vTier === "std" ? "active" : ""}`}
                  onClick={() => setVTier("std")}
                >
                  📄 Normal
                </button>
              </div>
            </div>

            {/* Row 2: Date-Wise & Device & Search */}
            <div className="admin-filter-row">
              <span className="admin-filter-label">Date Active:</span>
              <div className="admin-filter-group">
                <button
                  className={`admin-filter-pill ${vDate === "all" ? "active" : ""}`}
                  onClick={() => setVDate("all")}
                >
                  All Time
                </button>
                <button
                  className={`admin-filter-pill ${vDate === "today" ? "active" : ""}`}
                  onClick={() => setVDate("today")}
                >
                  📅 Today (24h)
                </button>
                <button
                  className={`admin-filter-pill ${vDate === "7d" ? "active" : ""}`}
                  onClick={() => setVDate("7d")}
                >
                  7 Days
                </button>
                <button
                  className={`admin-filter-pill ${vDate === "30d" ? "active" : ""}`}
                  onClick={() => setVDate("30d")}
                >
                  30 Days
                </button>
              </div>

              <span className="admin-filter-label" style={{ marginLeft: 10 }}>Device:</span>
              <div className="admin-filter-group">
                <button
                  className={`admin-filter-pill ${vDevice === "all" ? "active" : ""}`}
                  onClick={() => setVDevice("all")}
                >
                  All
                </button>
                <button
                  className={`admin-filter-pill ${vDevice === "mobile" ? "active" : ""}`}
                  onClick={() => setVDevice("mobile")}
                >
                  📱 Mobile ({mobileCount})
                </button>
                <button
                  className={`admin-filter-pill ${vDevice === "desktop" ? "active" : ""}`}
                  onClick={() => setVDevice("desktop")}
                >
                  💻 Desktop ({desktopCount})
                </button>
              </div>

              <div className="admin-search-wrap" style={{ marginLeft: "auto", minWidth: 220 }}>
                <input
                  className="admin-search-input"
                  type="text"
                  placeholder="Search Device ID, OS, Browser..."
                  value={vSearch}
                  onChange={(e) => setVSearch(e.target.value)}
                />
              </div>

              {(vPaid !== "all" || vDate !== "all" || vTier !== "all" || vDevice !== "all" || vSearch) && (
                <button
                  className="admin-btn-reset"
                  onClick={() => {
                    setVPaid("all");
                    setVDate("all");
                    setVTier("all");
                    setVDevice("all");
                    setVSearch("");
                  }}
                >
                  ✕ Reset
                </button>
              )}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>
              Showing {filteredVisitors.length} of {visitors.length} visitors
            </span>
          </div>

          {filteredVisitors.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 16px", color: "var(--dim)" }}>
              No visitors match the current filter criteria.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="admin-tbl">
                <thead>
                  <tr>
                    <th>Device ID</th>
                    <th>Hardware / OS / Browser</th>
                    <th>Visits</th>
                    <th>Customer Status</th>
                    <th>Total Paid</th>
                    <th>Post Version</th>
                    <th>Engagement</th>
                    <th>First Seen</th>
                    <th>Last Active</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVisitors.map((v) => (
                    <tr key={v.deviceId}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span className="admin-device-pill" title={v.deviceId}>
                            {v.displayId}
                          </span>
                          <button
                            className="admin-copy-btn"
                            title="Copy Device ID"
                            onClick={() => copyDeviceId(v.deviceId)}
                          >
                            {copiedId === v.deviceId ? "✓" : "📋"}
                          </button>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 550 }}>
                          <span style={{ fontSize: 16 }}>{v.icon}</span>
                          <span>{v.label}</span>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: "#0F172A" }}>{v.visitCount}</span>
                        <span style={{ fontSize: 11, color: "var(--dim)", marginLeft: 3 }}>pings</span>
                      </td>
                      <td>
                        {v.isPaid ? (
                          <span className="admin-badge-paid">
                            <span>✓</span> Paid Customer
                          </span>
                        ) : (
                          <span className="admin-badge-free">Free Visitor</span>
                        )}
                      </td>
                      <td>
                        {v.isPaid ? (
                          <span style={{ fontWeight: 800, color: "#059669", fontSize: 13.5 }}>
                            {v.totalPaid}
                          </span>
                        ) : (
                          <span style={{ color: "var(--faint)", fontSize: 12 }}>₹0.00</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {v.hasPinned && (
                            <span className="admin-badge-tier pin" title="User created a Pinned Post">
                              👑 Pinned
                            </span>
                          )}
                          {v.hasBoosted && (
                            <span className="admin-badge-tier glow" title="User created a Boosted Post">
                              ⚡ Boosted
                            </span>
                          )}
                          {v.hasNormal && (
                            <span className="admin-badge-tier std" title="User created a Normal Post">
                              Normal
                            </span>
                          )}
                          {!v.hasPinned && !v.hasBoosted && !v.hasNormal && (
                            <span style={{ color: "var(--faint)", fontSize: 12 }}>—</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: 12, color: "#334155" }}>
                          {v.postsCount > 0 && <span style={{ fontWeight: 650 }}>{v.postsCount} posts · </span>}
                          <span>{v.votesCount} votes</span>
                          {v.reactionsCount > 0 && <span> · {v.reactionsCount} reacts</span>}
                        </div>
                      </td>
                      <td style={{ fontSize: 12, color: "var(--dim)", whiteSpace: "nowrap" }}>
                        {formatRelativeTime(v.firstSeenAt)}
                      </td>
                      <td style={{ fontSize: 12, color: "#0F172A", fontWeight: 600, whiteSpace: "nowrap" }}>
                        {formatRelativeTime(v.lastSeenAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Confessions & Posts Explorer */}
      {activeTab === "posts" && (
        <div className="admin-card">
          {/* Multi-Dimensional Filter Bar for Posts */}
          <div className="admin-filter-bar">
            {/* Row 1: Paid Customer & Post Version */}
            <div className="admin-filter-row">
              <span className="admin-filter-label">Customer:</span>
              <div className="admin-filter-group">
                <button
                  className={`admin-filter-pill ${pPaid === "all" ? "active" : ""}`}
                  onClick={() => setPPaid("all")}
                >
                  All Posts ({posts.length})
                </button>
                <button
                  className={`admin-filter-pill ${pPaid === "paid" ? "active" : ""}`}
                  onClick={() => setPPaid("paid")}
                >
                  💰 Paid Posts Only
                </button>
                <button
                  className={`admin-filter-pill ${pPaid === "free" ? "active" : ""}`}
                  onClick={() => setPPaid("free")}
                >
                  Free Posts
                </button>
              </div>

              <span className="admin-filter-label" style={{ marginLeft: 10 }}>Post Version:</span>
              <div className="admin-filter-group">
                <button
                  className={`admin-filter-pill ${pTier === "all" ? "active" : ""}`}
                  onClick={() => setPTier("all")}
                >
                  All Versions
                </button>
                <button
                  className={`admin-filter-pill ${pTier === "pin" ? "active" : ""}`}
                  onClick={() => setPTier("pin")}
                >
                  👑 Pinned Version
                </button>
                <button
                  className={`admin-filter-pill ${pTier === "glow" ? "active" : ""}`}
                  onClick={() => setPTier("glow")}
                >
                  ⚡ Boosted Version
                </button>
                <button
                  className={`admin-filter-pill ${pTier === "std" ? "active" : ""}`}
                  onClick={() => setPTier("std")}
                >
                  📄 Normal Version
                </button>
              </div>
            </div>

            {/* Row 2: Date-Wise & Category & Search */}
            <div className="admin-filter-row">
              <span className="admin-filter-label">Date Wise:</span>
              <div className="admin-filter-group">
                <button
                  className={`admin-filter-pill ${pDate === "all" ? "active" : ""}`}
                  onClick={() => setPDate("all")}
                >
                  All Time
                </button>
                <button
                  className={`admin-filter-pill ${pDate === "today" ? "active" : ""}`}
                  onClick={() => setPDate("today")}
                >
                  📅 Today (24h)
                </button>
                <button
                  className={`admin-filter-pill ${pDate === "7d" ? "active" : ""}`}
                  onClick={() => setPDate("7d")}
                >
                  7 Days
                </button>
                <button
                  className={`admin-filter-pill ${pDate === "30d" ? "active" : ""}`}
                  onClick={() => setPDate("30d")}
                >
                  30 Days
                </button>
              </div>

              <span className="admin-filter-label" style={{ marginLeft: 10 }}>Category:</span>
              <select
                className="admin-filter-select"
                value={pCategory}
                onChange={(e) => setPCategory(e.target.value)}
              >
                <option value="all">All Categories</option>
                {postCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <span className="admin-filter-label" style={{ marginLeft: 10 }}>Sort:</span>
              <select
                className="admin-filter-select"
                value={pSort}
                onChange={(e) => setPSort(e.target.value as "newest" | "votes" | "revenue")}
              >
                <option value="newest">Newest First</option>
                <option value="votes">Most Votes</option>
                <option value="revenue">Highest Paid</option>
              </select>

              <div className="admin-search-wrap" style={{ marginLeft: "auto", minWidth: 220 }}>
                <input
                  className="admin-search-input"
                  type="text"
                  placeholder="Search confession text..."
                  value={pSearch}
                  onChange={(e) => setPSearch(e.target.value)}
                />
              </div>

              {(pPaid !== "all" || pDate !== "all" || pTier !== "all" || pCategory !== "all" || pSearch) && (
                <button
                  className="admin-btn-reset"
                  onClick={() => {
                    setPPaid("all");
                    setPDate("all");
                    setPTier("all");
                    setPCategory("all");
                    setPSearch("");
                    setPSort("newest");
                  }}
                >
                  ✕ Reset
                </button>
              )}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>
              Showing {filteredPosts.length} of {posts.length} posts
            </span>
          </div>

          {filteredPosts.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 16px", color: "var(--dim)" }}>
              No posts match the current filter criteria.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="admin-tbl">
                <thead>
                  <tr>
                    <th>Post Version</th>
                    <th>Confession Story / Dilemma</th>
                    <th>Category</th>
                    <th>Customer Status</th>
                    <th>Amount</th>
                    <th>Votes</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPosts.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <span className={`admin-badge-tier ${p.tier === "pin" ? "pin" : p.tier === "glow" ? "glow" : "std"}`}>
                          {p.tier === "pin" ? "👑 PINNED" : p.tier === "glow" ? "⚡ BOOSTED" : "NORMAL"}
                        </span>
                      </td>
                      <td style={{ maxWidth: 360 }}>
                        <div style={{ fontSize: 13, color: "#0F172A", fontWeight: 550, lineHeight: 1.4 }}>
                          {p.text}
                        </div>
                        {p.option_a && (
                          <div style={{ fontSize: 11.5, color: "#64748B", marginTop: 3 }}>
                            A: {p.option_a} ({p.votes_a}) · B: {p.option_b} ({p.votes_b})
                          </div>
                        )}
                        <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 2 }}>
                          id: {p.id}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: 12, fontWeight: 650, color: "#475569" }}>
                          {p.category}
                        </span>
                      </td>
                      <td>
                        {p.isPaid ? (
                          <span className="admin-badge-paid">
                            <span>✓</span> Paid
                          </span>
                        ) : (
                          <span className="admin-badge-free">Free</span>
                        )}
                      </td>
                      <td>
                        {p.isPaid ? (
                          <span style={{ fontWeight: 800, color: "#059669", fontSize: 13 }}>
                            {p.paidAmountFormatted}
                          </span>
                        ) : (
                          <span style={{ color: "var(--faint)", fontSize: 12 }}>₹0.00</span>
                        )}
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: "#0F172A" }}>{p.totalVotes}</span>
                      </td>
                      <td>
                        <span className={`admin-badge-status ${p.status === "live" ? "paid" : p.status === "pending_payment" ? "created" : "failed"}`}>
                          {p.hidden ? "hidden" : p.status}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: "var(--dim)", whiteSpace: "nowrap" }}>
                        {formatRelativeTime(p.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Live Payment & Orders Ledger */}
      {activeTab === "orders" && (
        <div className="admin-card">
          {/* Multi-Dimensional Filter Bar for Orders */}
          <div className="admin-filter-bar">
            {/* Row 1: Payment Status & Post Version */}
            <div className="admin-filter-row">
              <span className="admin-filter-label">Status:</span>
              <div className="admin-filter-group">
                <button
                  className={`admin-filter-pill ${oStatus === "all" ? "active" : ""}`}
                  onClick={() => setOStatus("all")}
                >
                  All Orders ({orders.length})
                </button>
                <button
                  className={`admin-filter-pill ${oStatus === "paid" ? "active" : ""}`}
                  onClick={() => setOStatus("paid")}
                >
                  ✓ Paid Only ({orders.filter((o) => o.status === "paid").length})
                </button>
                <button
                  className={`admin-filter-pill ${oStatus === "created" ? "active" : ""}`}
                  onClick={() => setOStatus("created")}
                >
                  ⏳ Pending / Created
                </button>
              </div>

              <span className="admin-filter-label" style={{ marginLeft: 10 }}>Post Version:</span>
              <div className="admin-filter-group">
                <button
                  className={`admin-filter-pill ${oTier === "all" ? "active" : ""}`}
                  onClick={() => setOTier("all")}
                >
                  All Versions
                </button>
                <button
                  className={`admin-filter-pill ${oTier === "pin" ? "active" : ""}`}
                  onClick={() => setOTier("pin")}
                >
                  👑 Pinned
                </button>
                <button
                  className={`admin-filter-pill ${oTier === "glow" ? "active" : ""}`}
                  onClick={() => setOTier("glow")}
                >
                  ⚡ Boosted
                </button>
                <button
                  className={`admin-filter-pill ${oTier === "std" ? "active" : ""}`}
                  onClick={() => setOTier("std")}
                >
                  📄 Normal
                </button>
              </div>
            </div>

            {/* Row 2: Date-Wise & Search */}
            <div className="admin-filter-row">
              <span className="admin-filter-label">Date Wise:</span>
              <div className="admin-filter-group">
                <button
                  className={`admin-filter-pill ${oDate === "all" ? "active" : ""}`}
                  onClick={() => setODate("all")}
                >
                  All Time
                </button>
                <button
                  className={`admin-filter-pill ${oDate === "today" ? "active" : ""}`}
                  onClick={() => setODate("today")}
                >
                  📅 Today (24h)
                </button>
                <button
                  className={`admin-filter-pill ${oDate === "7d" ? "active" : ""}`}
                  onClick={() => setODate("7d")}
                >
                  7 Days
                </button>
                <button
                  className={`admin-filter-pill ${oDate === "30d" ? "active" : ""}`}
                  onClick={() => setODate("30d")}
                >
                  30 Days
                </button>
              </div>

              <div className="admin-search-wrap" style={{ marginLeft: "auto", minWidth: 220 }}>
                <input
                  className="admin-search-input"
                  type="text"
                  placeholder="Search Order ID, Post..."
                  value={oSearch}
                  onChange={(e) => setOSearch(e.target.value)}
                />
              </div>

              {(oStatus !== "all" || oDate !== "all" || oTier !== "all" || oSearch) && (
                <button
                  className="admin-btn-reset"
                  onClick={() => {
                    setOStatus("all");
                    setODate("all");
                    setOTier("all");
                    setOSearch("");
                  }}
                >
                  ✕ Reset
                </button>
              )}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>
              Showing {filteredOrders.length} of {orders.length} orders
            </span>
          </div>

          {filteredOrders.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 16px", color: "var(--dim)" }}>
              No orders match the current filter criteria.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="admin-tbl">
                <thead>
                  <tr>
                    <th>Order ID / Gateway</th>
                    <th>Confession Post</th>
                    <th>Category</th>
                    <th>Post Version</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Date & Time</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <div style={{ fontWeight: 700, color: "#0F172A", fontSize: 12.5 }}>
                          {o.id.slice(0, 18)}...
                        </div>
                        <div style={{ fontSize: 11, color: "var(--dim)", textTransform: "uppercase" }}>
                          {o.gateway} {o.paymentId ? `· ${o.paymentId.slice(-8)}` : ""}
                        </div>
                      </td>
                      <td style={{ maxWidth: 320 }}>
                        <div style={{ fontSize: 12.5, color: "#1E293B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={o.postText}>
                          {o.postText}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--faint)" }}>
                          id: {o.postId}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>
                          {o.category}
                        </span>
                      </td>
                      <td>
                        <span className={`admin-badge-tier ${o.tier === "pin" ? "pin" : o.tier === "glow" ? "glow" : "std"}`}>
                          {o.tier === "pin" ? "👑 PINNED" : o.tier === "glow" ? "⚡ BOOSTED" : "NORMAL"}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 800, fontSize: 13.5, color: o.status === "paid" ? "#047857" : "#0F172A" }}>
                          {o.amountFormatted}
                        </span>
                      </td>
                      <td>
                        <span className={`admin-badge-status ${o.status}`}>
                          {o.status}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: "var(--dim)", whiteSpace: "nowrap" }}>
                        {formatRelativeTime(o.paidAt || o.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Moderation Queue */}
      {activeTab === "reports" && (
        <div className="admin-card">
          <h3 style={{ marginTop: 0 }}>Report queue</h3>
          <p style={{ fontSize: 13, marginTop: 0, color: "var(--dim)" }}>
            Flagged submissions requiring editorial or content moderation review.
          </p>
          {reports.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 16px", color: "var(--dim)" }}>
              🎉 Clean queue — nothing currently reported!
            </div>
          ) : (
            <table className="admin-tbl">
              <thead>
                <tr>
                  <th>Text</th>
                  <th>Category</th>
                  <th>Reports</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id}>
                    <td style={{ maxWidth: 380 }}>
                      {r.text.slice(0, 160)}
                      {r.option_a ? ` (${r.option_a} / ${r.option_b})` : ""}
                    </td>
                    <td>{r.category}</td>
                    <td><b>{r.reports}</b></td>
                    <td>
                      <span className={`admin-badge-status ${r.hidden ? "failed" : "paid"}`}>
                        {r.hidden ? "hidden" : "visible"}
                      </span>
                    </td>
                    <td>
                      {r.hidden ? (
                        <button className="lnk" onClick={() => takedown(r.id, "unhide")}>
                          Restore
                        </button>
                      ) : (
                        <button className="lnk" style={{ color: "#B91C1C", fontWeight: 650 }} onClick={() => takedown(r.id, "hide")}>
                          Take down
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* TAB 5: Tools & Recovery */}
      {activeTab === "tools" && (
        <>
          <div className="admin-card">
            <h3 style={{ marginTop: 0 }}>Recover a post</h3>
            <p style={{ fontSize: 13, marginTop: 0, color: "var(--dim)" }}>
              Re-point a post at a different owner key — for when someone paid and posted, but their browser lost the key
              (e.g. cleared storage, or user swapped devices). Only do this once you&apos;re sure the post is really theirs.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input
                placeholder="Post id (e.g. p3495d9edf18546dd)"
                value={recPostId}
                onChange={(e) => setRecPostId(e.target.value)}
                style={{ minWidth: 240, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--rule)" }}
              />
              <input
                placeholder="Owner key (e.g. UN-AB3KX)"
                value={recOwnerKey}
                onChange={(e) => setRecOwnerKey(e.target.value)}
                style={{ minWidth: 180, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--rule)" }}
              />
              <button className="btn" onClick={reassignOwner} disabled={recBusy || !recPostId.trim() || !recOwnerKey.trim()}>
                {recBusy ? "Reassigning…" : "Reassign"}
              </button>
            </div>
            {recMsg && <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600 }}>{recMsg}</div>}
          </div>

          <div className="admin-card">
            <h3 style={{ marginTop: 0 }}>Seeded launch content</h3>
            <p style={{ fontSize: 13, marginTop: 0, color: "var(--dim)" }}>
              Hides every post from the original launch seed batch (scripts/inject_seed.py) from the board — matched by
              exact post id, so this can never touch a real visitor&apos;s post.
            </p>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button className="btn gh" style={{ color: "#B91C1C", borderColor: "#FECACA" }} onClick={purgeSeedContent} disabled={purgeBusy}>
                {purgeBusy ? "Removing…" : purgeArmed ? "Click again to confirm — hides 469 posts" : "Remove seeded content from board"}
              </button>
              {purgeArmed && !purgeBusy && (
                <button className="lnk" onClick={() => setPurgeArmed(false)}>
                  Cancel
                </button>
              )}
            </div>
            {purgeMsg && <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600 }}>{purgeMsg}</div>}
          </div>
        </>
      )}
    </div>
  );
}


