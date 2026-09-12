"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CUR, CurrencyCode } from "@/lib/currency";
import { useCurrency } from "@/app/hooks/useCurrency";
import { nf } from "@/lib/board-helpers";

export default function Footer() {
  const { code, setCode } = useCurrency();
  const [stats, setStats] = useState<{ total: number; totalVotes: number; totalReactions: number; today: number } | null>(null);
  const [presenceToday, setPresenceToday] = useState(0);

  useEffect(() => {
    fetch("/api/stats").then((r) => r.json()).then(setStats).catch(() => {});
    fetch("/api/presence", { method: "POST" }).then((r) => r.json()).then((p) => setPresenceToday(p.today ?? 0)).catch(() => {});
  }, []);

  const SHOW_AT = 50;
  const bits: string[] = [];
  if (stats) {
    if (stats.total >= 10) bits.push(`${nf(stats.total)} on the board`);
    if (stats.totalVotes >= SHOW_AT) bits.push(`${nf(stats.totalVotes)} votes cast`);
    if (stats.totalReactions >= SHOW_AT) bits.push(`${nf(stats.totalReactions)} reactions`);
    if (stats.today >= 3) bits.push(`${nf(stats.today)} posted today`);
  }
  if (presenceToday >= 5) bits.push(`${nf(presenceToday)} visitors today`);

  return (
    <footer className="site-foot">
      <Link href="/rules">Rules</Link> · <Link href="/terms">Terms</Link> · <Link href="/refund">Refund Policy</Link> ·{" "}
      <Link href="/privacy">Privacy Policy</Link> · <Link href="/about">About</Link> ·{" "}
      <span>Anonymous. No accounts. No ads.</span> ·{" "}
      <select className="cursel" aria-label="Currency" value={code} onChange={(e) => setCode(e.target.value as CurrencyCode)}>
        {Object.values(CUR).map((c) => (
          <option key={c.code} value={c.code}>
            {c.code}
          </option>
        ))}
      </select>
      <br />
      <span>{bits.length ? bits.join(" · ") + " · nothing here is sponsored." : "Nothing here is sponsored, and nothing is an ad."}</span>
    </footer>
  );
}
