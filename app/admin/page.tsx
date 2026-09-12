"use client";
import { useEffect, useState } from "react";

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

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const [r1, r2] = await Promise.all([fetch("/api/admin/reports"), fetch("/api/admin/summary")]);
    if (r1.status === 401 || r2.status === 401) {
      setAuthed(false);
      return;
    }
    setAuthed(true);
    setReports((await r1.json()).reports ?? []);
    setSummary(await r2.json());
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login() {
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Wrong password.");
      setAuthed(true);
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not log in.");
    } finally {
      setBusy(false);
    }
  }

  async function takedown(id: string, action: "hide" | "unhide") {
    await fetch(`/api/admin/posts/${id}/takedown`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    load();
  }

  if (!authed) {
    return (
      <div className="page">
        <div className="admin-login">
          <h2>Admin</h2>
          <p>Password-protected. Set ADMIN_PASSWORD in your environment.</p>
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && login()} />
          {err && <div className="rerr show">{err}</div>}
          <button className="btn" onClick={login} disabled={busy}>
            Log in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <h2>Admin</h2>

      {summary && (
        <div className="admin-card">
          <div className="admin-stats">
            <div className="admin-stat">
              <b>{summary.liveCount}</b>
              <span>live posts</span>
            </div>
            <div className="admin-stat">
              <b>{summary.pendingCount}</b>
              <span>pending payment</span>
            </div>
            <div className="admin-stat">
              <b>{summary.reportedCount}</b>
              <span>reported (visible)</span>
            </div>
            <div className="admin-stat">
              <b>{summary.paidOrderCount}</b>
              <span>paid orders total</span>
            </div>
            <div className="admin-stat">
              <b>{summary.last24hPaidCount}</b>
              <span>paid, last 24h</span>
            </div>
          </div>
          <div style={{ marginTop: 14, fontSize: 13 }}>
            Revenue:{" "}
            {Object.entries(summary.revenueByCurrency).length
              ? Object.entries(summary.revenueByCurrency)
                  .map(([cur, minor]) => `${(minor / 100).toFixed(2)} ${cur}`)
                  .join(" · ")
              : "none yet"}
          </div>
        </div>
      )}

      <div className="admin-card">
        <h3 style={{ marginTop: 0 }}>Report queue</h3>
        {reports.length === 0 ? (
          <p>Nothing reported.</p>
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
                  <td>{r.reports}</td>
                  <td>{r.hidden ? "hidden" : "visible"}</td>
                  <td>
                    {r.hidden ? (
                      <button className="lnk" onClick={() => takedown(r.id, "unhide")}>
                        Restore
                      </button>
                    ) : (
                      <button className="lnk" style={{ color: "#B91C1C" }} onClick={() => takedown(r.id, "hide")}>
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
    </div>
  );
}
