import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabase";
import { getTrackedMetadata } from "@/lib/deviceTracker";
import { parseDevice } from "@/lib/deviceParser";

export const runtime = "nodejs";

export interface VisitorItem {
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
  postTiers: string[];
  hasPinned: boolean;
  hasBoosted: boolean;
  hasNormal: boolean;
}

export interface VisitorsResponse {
  visitors: VisitorItem[];
  metrics: {
    totalVisitors: number;
    paidVisitors: number;
    conversionRate: string;
    totalRevenueMinor: number;
    totalRevenueFormatted: string;
    desktopCount: number;
    mobileCount: number;
    totalVotesCount: number;
    totalReactionsCount: number;
  };
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sb = supabaseAdmin();

  const [heartbeatsRes, votesRes, reactsRes, postsRes, ordersRes] = await Promise.all([
    sb.from("presence_heartbeats").select("session_id, first_seen_at, last_seen_at").order("last_seen_at", { ascending: false }).limit(300),
    sb.from("votes").select("voter_id, owner_key_hash, created_at"),
    sb.from("reactions_log").select("voter_id, owner_key_hash, created_at"),
    sb.from("posts").select("id, owner_key_hash, tier, status, paid_amount_minor, currency, created_at, paid_at"),
    sb.from("payment_orders").select("id, post_id, amount_minor, currency, status, paid_at"),
  ]);

  const heartbeats = heartbeatsRes.data ?? [];
  const votes = votesRes.data ?? [];
  const reacts = reactsRes.data ?? [];
  const posts = postsRes.data ?? [];
  const orders = ordersRes.data ?? [];

  // Map post IDs to their paid order amounts
  const postPaidAmount = new Map<string, { minor: number; currency: string }>();
  for (const o of orders) {
    if (o.status === "paid" && o.amount_minor > 0) {
      postPaidAmount.set(o.post_id, { minor: o.amount_minor, currency: o.currency || "INR" });
    }
  }

  // Group posts and paid amounts by owner_key_hash
  const ownerStats = new Map<
    string,
    {
      totalPaidMinor: number;
      currency: string;
      postsCount: number;
      paidPostsCount: number;
      tiers: Set<string>;
    }
  >();

  for (const p of posts) {
    if (!p.owner_key_hash) continue;
    const cur = ownerStats.get(p.owner_key_hash) || {
      totalPaidMinor: 0,
      currency: p.currency || "INR",
      postsCount: 0,
      paidPostsCount: 0,
      tiers: new Set<string>(),
    };
    cur.postsCount += 1;
    if (p.tier) cur.tiers.add(p.tier);
    const orderPaid = postPaidAmount.get(p.id)?.minor ?? 0;
    const directPaid = p.status === "live" && p.paid_amount_minor ? p.paid_amount_minor : 0;
    const paidMinor = Math.max(orderPaid, directPaid);
    if (paidMinor > 0) {
      cur.totalPaidMinor += paidMinor;
      cur.paidPostsCount += 1;
      cur.currency = p.currency || "INR";
    }
    ownerStats.set(p.owner_key_hash, cur);
  }

  // Map voter_id to owner_key_hashes
  const voterToOwnerKeys = new Map<string, Set<string>>();
  const voterVotes = new Map<string, number>();
  const voterReacts = new Map<string, number>();

  for (const v of votes) {
    voterVotes.set(v.voter_id, (voterVotes.get(v.voter_id) ?? 0) + 1);
    if (v.owner_key_hash) {
      const set = voterToOwnerKeys.get(v.voter_id) || new Set();
      set.add(v.owner_key_hash);
      voterToOwnerKeys.set(v.voter_id, set);
    }
  }

  for (const r of reacts) {
    voterReacts.set(r.voter_id, (voterReacts.get(r.voter_id) ?? 0) + 1);
    if (r.owner_key_hash) {
      const set = voterToOwnerKeys.get(r.voter_id) || new Set();
      set.add(r.owner_key_hash);
      voterToOwnerKeys.set(r.voter_id, set);
    }
  }

  // Build visitor list
  const visitorMap = new Map<string, VisitorItem>();

  for (const hb of heartbeats) {
    const voterId = hb.session_id;
    const tracked = getTrackedMetadata(voterId);

    // Correlate owner keys
    const ownerKeys = voterToOwnerKeys.get(voterId) || new Set<string>();
    if (tracked.ownerKeyHash) {
      ownerKeys.add(tracked.ownerKeyHash);
    }

    let totalPaidMinor = 0;
    let postsCount = 0;
    let paidPostsCount = 0;
    let currency = "INR";
    const tiers = new Set<string>();

    for (const okHash of ownerKeys) {
      const st = ownerStats.get(okHash);
      if (st) {
        totalPaidMinor += st.totalPaidMinor;
        postsCount += st.postsCount;
        paidPostsCount += st.paidPostsCount;
        currency = st.currency;
        st.tiers.forEach((t) => tiers.add(t));
      }
    }

    const isPaid = totalPaidMinor > 0;
    const displayId = "dev_" + voterId.replace(/-/g, "").slice(0, 8);

    const postTiers = Array.from(tiers);
    const hasPinned = tiers.has("pin");
    const hasBoosted = tiers.has("glow");
    const hasNormal = tiers.has("std") || (postsCount > 0 && !hasPinned && !hasBoosted);

    visitorMap.set(voterId, {
      deviceId: voterId,
      displayId,
      deviceType: tracked.details.deviceType,
      os: tracked.details.os,
      browser: tracked.details.browser,
      label: tracked.details.label,
      icon: tracked.details.icon,
      firstSeenAt: hb.first_seen_at,
      lastSeenAt: hb.last_seen_at,
      visitCount: Math.max(1, tracked.visitCount),
      isPaid,
      totalPaidMinor,
      totalPaid: totalPaidMinor > 0 ? `₹${(totalPaidMinor / 100).toFixed(2)}` : "₹0.00",
      currency,
      postsCount,
      paidPostsCount,
      votesCount: voterVotes.get(voterId) ?? 0,
      reactionsCount: voterReacts.get(voterId) ?? 0,
      postTiers,
      hasPinned,
      hasBoosted,
      hasNormal,
    });
  }

  const visitors = Array.from(visitorMap.values()).sort(
    (a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime()
  );

  let paidVisitors = 0;
  let totalRevenueMinor = 0;
  let mobileCount = 0;
  let desktopCount = 0;
  let totalVotesCount = 0;
  let totalReactionsCount = 0;

  for (const v of visitors) {
    if (v.isPaid) {
      paidVisitors++;
      totalRevenueMinor += v.totalPaidMinor;
    }
    if (v.deviceType === "mobile" || v.deviceType === "tablet") {
      mobileCount++;
    } else {
      desktopCount++;
    }
    totalVotesCount += v.votesCount;
    totalReactionsCount += v.reactionsCount;
  }

  const totalVisitors = visitors.length;
  const conversionRate = totalVisitors > 0 ? ((paidVisitors / totalVisitors) * 100).toFixed(1) + "%" : "0.0%";

  return NextResponse.json({
    visitors,
    metrics: {
      totalVisitors,
      paidVisitors,
      conversionRate,
      totalRevenueMinor,
      totalRevenueFormatted: `₹${(totalRevenueMinor / 100).toFixed(2)}`,
      desktopCount,
      mobileCount,
      totalVotesCount,
      totalReactionsCount,
    },
  });
}
