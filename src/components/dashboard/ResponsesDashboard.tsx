"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Status = "interested" | "declined" | "pending";
export type ResponseRow = { id: string; company: string; to: string; sentAt: string; preview: boolean; respondedAt: string | null; gameClickedAt: string | null; status: Status };
const segments: { id: Status; label: string; color: string }[] = [
  { id: "interested", label: "Interested", color: "#387b68" },
  { id: "declined", label: "No thanks", color: "#b47660" },
];
export function ResponsesDashboard({ rows: initialRows, counts: initialCounts }: { rows: ResponseRow[]; counts: Record<Status, number> }) {
  const [filter, setFilter] = useState<Status | "all">("all");
  const [page, setPage] = useState(0);
  const [data, setData] = useState({ rows: initialRows, counts: initialCounts });
  const { rows, counts } = data;
  const [error, setError] = useState("");
  const [checkedAt, setCheckedAt] = useState("");
  const inFlight = useRef(false);
  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const response = await fetch("/api/velho/responses", { cache: "no-store", credentials: "same-origin" });
      const snapshot = await response.json();
      if (!response.ok) throw new Error(snapshot.error || "Could not refresh responses.");
      setData(snapshot); setError("");
      setCheckedAt(new Date().toLocaleTimeString("en-GB"));
    } catch (error) { setError(error instanceof Error ? error.message : "Could not refresh responses."); }
    finally { inFlight.current = false; }
  }, []);
  useEffect(() => {
    const check = () => { if (document.visibilityState === "visible") void refresh(); };
    check();
    const timer = window.setInterval(check, 5000);
    window.addEventListener("focus", check);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", check); };
  }, [refresh]);
  const total = counts.interested + counts.declined;
  const visible = rows.filter((row) => row.status !== "pending" && (filter === "all" || row.status === filter));
  const pages = Math.max(1, Math.ceil(visible.length / 5));
  const current = Math.min(page, pages - 1);
  const circumference = 2 * Math.PI * 48;
  let offset = 0;
  const arcs = segments.map((segment) => {
    const length = total ? counts[segment.id] / total * circumference : 0;
    const arc = { ...segment, length, offset }; offset += length; return arc;
  });
  return <main className="marketing-main">
    <div className="marketing-heading"><h1>Company responses</h1><span className="marketing-demo-badge"><i /> Demo invitations</span></div>
    <section className="marketing-overview" aria-label="Invitation responses">
      <div className="marketing-pie-summary"><div className="marketing-pie">
        <svg viewBox="0 0 120 120" role="img" aria-label={`${counts.interested} interested, ${counts.declined} declined`}>
          <circle cx="60" cy="60" r="48" fill="none" stroke="#f0ede5" strokeWidth="16" />
          {arcs.filter((arc) => arc.length > 0).map((arc) => <circle key={arc.id} cx="60" cy="60" r="48" fill="none" stroke={arc.color} strokeWidth="16" strokeDasharray={`${arc.length} ${circumference - arc.length}`} strokeDashoffset={-arc.offset} transform="rotate(-90 60 60)" opacity={filter === "all" || filter === arc.id ? 1 : .2} />)}
        </svg><button onClick={() => { setFilter("all"); setPage(0); }} aria-label="Show all responses"><strong>{total}</strong><span>responses</span></button>
      </div><div className="marketing-pie-legend"><h2>Response mix</h2>{segments.map((segment) => <button key={segment.id} aria-pressed={filter === segment.id} onClick={() => { setFilter(filter === segment.id ? "all" : segment.id); setPage(0); }}><i style={{ background: segment.color }} /><span>{segment.label}</span><strong>{counts[segment.id]}</strong><small>{total ? Math.round(counts[segment.id] / total * 100) : 0}%</small></button>)}</div></div>
      <dl className="marketing-counts"><div><dt>Response rate</dt><dd>{rows.length ? Math.round(total / rows.length * 100) : 0}%</dd></div><div><dt>Interested</dt><dd>{counts.interested}</dd></div></dl>
    </section>
    <section className="marketing-companies"><div className="marketing-section-heading"><h2>{filter === "all" ? "All responses" : segments.find((segment) => segment.id === filter)?.label}</h2></div>
      <p className="response-note">Updates automatically · draft preview clicks are included.{checkedAt && ` Last checked ${checkedAt}.`}</p>
      {error && <p role="alert" className="response-note response-error">{error}</p>}
      <div className="marketing-table-wrap"><table className="marketing-table"><thead><tr><th>Company</th><th>Response</th><th>Updated</th></tr></thead><tbody>{visible.slice(current * 5, current * 5 + 5).map((row) => <tr key={row.id}><td><strong>{row.company}</strong></td><td><span className={`response-status is-${row.status}`}>{segments.find((segment) => segment.id === row.status)?.label}</span></td><td>{new Date(row.respondedAt ?? row.sentAt).toLocaleString("en-GB", { timeZone: "Europe/Helsinki", dateStyle: "short", timeStyle: "short" })}</td></tr>)}</tbody></table>
      {!visible.length && <div className="marketing-empty"><h3>{total ? "No matching responses" : "No responses yet"}</h3><p>{total ? "Choose another chart category." : "Open an opportunity, draft an invitation and click one of its email buttons."}</p></div>}</div>
      <div className="marketing-pagination"><span>{visible.length} responses</span><div><button disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</button><span>{current + 1} / {pages}</span><button disabled={current + 1 >= pages} onClick={() => setPage(current + 1)}>Next</button></div></div>
    </section>
  </main>;
}
