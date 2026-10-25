"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Status = "interested" | "declined" | "pending";
export type ResponseRow = { id: string; company: string; to: string; sentAt: string; respondedAt: string | null; status: Status };
const segments: { id: Status; label: string; color: string }[] = [
  { id: "interested", label: "Interested", color: "#387b68" },
  { id: "declined", label: "No thanks", color: "#b47660" },
  { id: "pending", label: "No response", color: "#7aa3d6" },
];
export function ResponsesDashboard({ rows, counts }: { rows: ResponseRow[]; counts: Record<Status, number> }) {
  const [filter, setFilter] = useState<Status | "all">("all");
  const [page, setPage] = useState(0);
  const router = useRouter();
  const total = rows.length;
  const visible = rows.filter((row) => filter === "all" || row.status === filter);
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
        <svg viewBox="0 0 120 120" role="img" aria-label={`${counts.interested} interested, ${counts.declined} declined, ${counts.pending} without a response`}>
          <circle cx="60" cy="60" r="48" fill="none" stroke="#f0ede5" strokeWidth="16" />
          {arcs.filter((arc) => arc.length > 0).map((arc) => <circle key={arc.id} cx="60" cy="60" r="48" fill="none" stroke={arc.color} strokeWidth="16" strokeDasharray={`${arc.length} ${circumference - arc.length}`} strokeDashoffset={-arc.offset} transform="rotate(-90 60 60)" opacity={filter === "all" || filter === arc.id ? 1 : .2} />)}
        </svg><button onClick={() => { setFilter("all"); setPage(0); }} aria-label="Show all invitations"><strong>{total}</strong><span>invitations</span></button>
      </div><div className="marketing-pie-legend"><h2>Response mix</h2>{segments.map((segment) => <button key={segment.id} aria-pressed={filter === segment.id} onClick={() => { setFilter(filter === segment.id ? "all" : segment.id); setPage(0); }}><i style={{ background: segment.color }} /><span>{segment.label}</span><strong>{counts[segment.id]}</strong><small>{total ? Math.round(counts[segment.id] / total * 100) : 0}%</small></button>)}</div></div>
      <dl className="marketing-counts"><div><dt>Response rate</dt><dd>{total ? Math.round((counts.interested + counts.declined) / total * 100) : 0}%</dd></div><div><dt>Interested</dt><dd>{counts.interested}</dd></div></dl>
    </section>
    <section className="marketing-companies"><div className="marketing-section-heading"><h2>{filter === "all" ? "All invitations" : segments.find((segment) => segment.id === filter)?.label}</h2><button onClick={() => router.refresh()}>Refresh responses ↻</button></div>
      <p className="response-note">Counts cover demo invitations, not real deliveries. Drafts are excluded.</p>
      <div className="marketing-table-wrap"><table className="marketing-table"><thead><tr><th>Company</th><th>Recipient</th><th>Response</th><th>Updated</th></tr></thead><tbody>{visible.slice(current * 5, current * 5 + 5).map((row) => <tr key={row.id}><td><strong>{row.company}</strong></td><td>{row.to}</td><td><span className={`response-status is-${row.status}`}>{segments.find((segment) => segment.id === row.status)?.label}</span></td><td>{new Date(row.respondedAt ?? row.sentAt).toLocaleString("en-GB", { timeZone: "Europe/Helsinki", dateStyle: "short", timeStyle: "short" })}</td></tr>)}</tbody></table>
      {!visible.length && <div className="marketing-empty"><h3>{total ? "No matching responses" : "No invitations yet"}</h3><p>{total ? "Choose another chart category." : "Open an opportunity, draft an invitation and press Send demo."}</p></div>}</div>
      <div className="marketing-pagination"><span>{visible.length} invitations</span><div><button disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</button><span>{current + 1} / {pages}</span><button disabled={current + 1 >= pages} onClick={() => setPage(current + 1)}>Next</button></div></div>
    </section>
  </main>;
}
