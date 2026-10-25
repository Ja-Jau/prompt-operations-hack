"use client";

import { useMemo, useRef, useState } from "react";
import type { HiringCompany } from "@/types/company";
import type { RoleSolution } from "@/lib/case/solution";
import type { ContactSheet } from "@/lib/outreach/contacts";
import type { EmailDraft } from "@/lib/outreach/email";
import { prepareInvitation, sendDemoInvitation } from "@/app/velho/responses/actions";
import { draftOpportunityEmail, invitationEmailHtml, type InvitationLinks } from "@/lib/outreach/marketing";
import type { Tier } from "@/lib/outreach/targets";
import { CompanyLogo } from "@/components/game/CompanyLogo";
import { Icon } from "@/components/ui/Icon";
import { FetchJobAds } from "./FetchJobAds";
import { PriorityChart } from "./PriorityChart";
import "./marketing.css";

export type MarketingProspect = { company: HiringCompany; solution: RoleSolution; contacts: ContactSheet; score: number; tier: Tier; staffing: boolean };
type Draft = EmailDraft & { token: string; links: InvitationLinks };
type DemoActivity = { companyId: string; company: string; to: string; at: string };
const PAGE_SIZE = 5;

/** Draft editing stays local; demo invitations and responses persist without email delivery. */
export function MarketingDashboard({ prospects, totalCompanies, updatedAt, automatic = false, lastRefreshError = null }: { prospects: MarketingProspect[]; totalCompanies: number; updatedAt: string; automatic?: boolean; lastRefreshError?: string | null }) {
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("all");
  const [filter, setFilter] = useState<"all" | "reviewed" | "employers">("all");
  const [page, setPage] = useState(0);
  const [tier, setTier] = useState<Tier | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"analysis" | "email">("analysis");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [simulated, setSimulated] = useState<Record<string, boolean>>({});
  const [activity, setActivity] = useState<DemoActivity[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const selected = prospects.find((prospect) => prospect.company.id === selectedId);
  const draft = selectedId ? drafts[selectedId] : undefined;
  const areas = useMemo(() => [...new Set(prospects.map((prospect) => prospect.solution.area))].sort(), [prospects]);
  const visible = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return prospects.filter((prospect) => (area === "all" || prospect.solution.area === area)
      && (tier === "all" || prospect.tier === tier)
      && (filter !== "reviewed" || prospect.solution.basis === "reviewed")
      && (filter !== "employers" || !prospect.staffing)
      && (!search || [prospect.company.name, prospect.solution.role, prospect.solution.action, ...prospect.company.locations].join(" ").toLocaleLowerCase().includes(search)));
  }, [prospects, query, area, filter, tier]);
  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const activePage = Math.min(page, pages - 1);
  const rows = visible.slice(activePage * PAGE_SIZE, (activePage + 1) * PAGE_SIZE);
  const counts = useMemo(() => ({ hot: prospects.filter((p) => p.tier === "hot").length, warm: prospects.filter((p) => p.tier === "warm").length, watch: prospects.filter((p) => p.tier === "watch").length }), [prospects]);
  const manual = prospects.reduce((sum, prospect) => sum + prospect.company.jobAds.manual, 0);

  async function ensureDraft(prospect: MarketingProspect, regenerate = false) {
    if (busy || (!regenerate && drafts[prospect.company.id])) return;
    setBusy(true); setError("");
    try {
      const token = await prepareInvitation(prospect.company.id);
      const origin = window.location.origin;
      const links = { game: `${origin}/respond/${token}?choice=game`, interested: `${origin}/respond/${token}?choice=interested`, declined: `${origin}/respond/${token}?choice=declined` };
      const generated = draftOpportunityEmail(prospect.company, prospect.contacts, `${origin}/brief/${prospect.company.id}`, prospect.solution, links);
      setDrafts((previous) => ({ ...previous, [prospect.company.id]: { ...generated, token, links } }));
      setSimulated((previous) => ({ ...previous, [prospect.company.id]: false })); setCopied(false);
    } catch { setError("Could not prepare the invitation. Please try again."); }
    finally { setBusy(false); }
  }
  function open(prospect: MarketingProspect, compose: boolean) {
    setSelectedId(prospect.company.id); setTab(compose ? "email" : "analysis"); setCopied(false); setCopyError(false); setError("");
    if (compose) ensureDraft(prospect);
    dialog.current?.showModal();
  }
  function updateDraft(patch: Partial<Draft>) {
    if (!selectedId) return;
    setDrafts((previous) => ({ ...previous, [selectedId]: { ...previous[selectedId], ...patch } }));
    setSimulated((previous) => ({ ...previous, [selectedId]: false })); setCopied(false);
  }
  async function copyDraft() {
    if (!draft) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({
        "text/html": new Blob([invitationEmailHtml(draft, draft.links)], { type: "text/html" }),
        "text/plain": new Blob([draft.body], { type: "text/plain" }),
      })]);
      setCopied(true); setCopyError(false);
    } catch { setCopyError(true); }
  }
  function downloadEmail() {
    if (!draft) return;
    const url = URL.createObjectURL(new Blob([invitationEmailHtml(draft, draft.links)], { type: "text/html" }));
    const link = document.createElement("a"); link.href = url; link.download = "velho-invitation.html";
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function simulateSend() {
    if (!selected || !draft || busy) return;
    setBusy(true); setError("");
    try {
      await sendDemoInvitation(draft.token, draft.to, draft.subject);
      setSimulated((previous) => ({ ...previous, [selected.company.id]: true }));
      setActivity((previous) => [{ companyId: selected.company.id, company: selected.company.name, to: draft.to, at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }, ...previous].slice(0, 5));
    } catch { setError("Could not save the demo invitation. Nothing was sent. Please try again."); }
    finally { setBusy(false); }
  }

  return <main className="marketing-main">
    <div className="marketing-heading"><h1>Marketing dashboard</h1><span className="marketing-demo-badge"><i /> Demo · no emails sent</span></div>
    <FetchJobAds updatedAt={updatedAt} automatic={automatic} lastError={lastRefreshError} />
    <section className="marketing-overview" aria-label="Company analysis overview">
      <PriorityChart counts={counts} selected={tier} onSelect={(value) => { setTier(value); setPage(0); }} />
      <dl className="marketing-counts">{[
        { label: "Analyzed", value: totalCompanies }, { label: "Ads flagged", value: manual },
      ].map((stat) => <div key={stat.label}><dt>{stat.label}</dt><dd>{stat.value}</dd></div>)}</dl>
    </section>
    <section className="marketing-companies" aria-labelledby="marketing-companies-title">
      <div className="marketing-section-heading"><div><h2 id="marketing-companies-title">Opportunities</h2></div><span>{visible.length} companies</span></div>
      <div className="marketing-filters">
        <label className="marketing-search"><span className="sr-only">Search companies, roles or locations</span><Icon name="target" /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="Search companies or roles…" /></label>
        <label><span className="sr-only">Automation area</span><select aria-label="Automation area" value={area} onChange={(event) => { setArea(event.target.value); setPage(0); }}><option value="all">All areas</option>{areas.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label><span className="sr-only">Company filter</span><select aria-label="Company filter" value={filter} onChange={(event) => { setFilter(event.target.value as typeof filter); setPage(0); }}><option value="all">All companies</option><option value="reviewed">Reviewed plans</option><option value="employers">Direct employers</option></select></label>
      </div>
      <div className="marketing-table-wrap"><table className="marketing-table"><thead><tr><th>Company</th><th>Role / focus</th><th>Flagged ads</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>
        {rows.map((prospect) => <tr key={prospect.company.id}>
          <td><button className="marketing-company" onClick={() => open(prospect, false)}><CompanyLogo company={prospect.company} className="h-9 w-9" /><span><strong>{prospect.company.name}</strong><small>{prospect.staffing ? "Staffing agency · client roles" : prospect.company.locations.slice(0, 2).join(" · ") || "Finland"}</small></span></button>{(simulated[prospect.company.id] || drafts[prospect.company.id]) && <span className={`marketing-status ${simulated[prospect.company.id] ? "is-simulated" : ""}`}>{simulated[prospect.company.id] ? "Demo sent" : "Draft ready"}</span>}</td>
          <td><strong className="marketing-role">{prospect.solution.role}</strong><span className="marketing-area">{prospect.solution.area}</span></td>
          <td><strong className="marketing-evidence-count">{prospect.company.jobAds.manual}<span>/{prospect.company.jobAds.checked}</span></strong><span className={`marketing-priority is-${prospect.tier}`}>{prospect.tier === "hot" ? "High" : prospect.tier === "warm" ? "Medium" : "Watch"} priority</span></td>
          <td><div className="marketing-row-actions"><button onClick={() => open(prospect, true)}>Draft email<Icon name="arrowRight" /></button><button onClick={() => open(prospect, false)}>View analysis</button></div></td>
        </tr>)}
      </tbody></table>{!rows.length && <div className="marketing-empty"><Icon name="target" /><h3>No matching companies</h3><p>Try a different role, company name or filter.</p><button onClick={() => { setQuery(""); setArea("all"); setFilter("all"); setTier("all"); setPage(0); }}>Clear filters</button></div>}</div>
      <div className="marketing-pagination"><span>{visible.length ? `${activePage * PAGE_SIZE + 1}–${Math.min((activePage + 1) * PAGE_SIZE, visible.length)} of ${visible.length}` : "0 companies"}</span><div><button disabled={activePage === 0} onClick={() => setPage(activePage - 1)}>Previous</button><span>{activePage + 1} / {pages}</span><button disabled={activePage + 1 >= pages} onClick={() => setPage(activePage + 1)}>Next</button></div></div>
    </section>
    {activity.length > 0 && <section className="marketing-activity" aria-label="Demo activity"><h2>Demo activity</h2>{activity.map((entry, i) => <p key={`${entry.companyId}-${i}`}><span>{entry.at}</span><strong>{entry.company}</strong><span>Demo · {entry.to}</span></p>)}</section>}
    <dialog ref={dialog} className="marketing-dialog" aria-label={selected ? `${selected.company.name} analysis and email draft` : "Company analysis"}>
      {selected && <>
        <header className="marketing-dialog-heading"><CompanyLogo key={selected.company.id} company={selected.company} className="h-10 w-10" /><div><p>{selected.solution.area}</p><h2>{selected.company.name}</h2></div><button autoFocus aria-label="Close company details" onClick={() => dialog.current?.close()}><Icon name="cross" /></button></header>
        <div className="marketing-tabs"><button aria-pressed={tab === "analysis"} onClick={() => setTab("analysis")}>Analysis</button><button aria-pressed={tab === "email"} onClick={() => { ensureDraft(selected); setTab("email"); }}>Email draft</button><span>DEMO ONLY</span></div>
        {tab === "analysis" ? <div className="marketing-analysis">
          <div className="marketing-analysis-role"><p className="eyebrow">Role</p><h3>{selected.solution.role}</h3>{selected.staffing && <p className="marketing-agency-note">Staffing agency. The end employer is not identified.</p>}</div>
          <section><h3>Proposed fix</h3><p className="marketing-analysis-action">{selected.solution.action}</p><p>{selected.solution.reasoning}</p><div className="marketing-human"><Icon name="check" /><span>{selected.solution.people}</span></div></section>
          <section><h3>Ad evidence</h3>{selected.company.jobAds.ads.slice(0, 2).map((ad, i) => <figure key={`${ad.url}-${i}`}><blockquote>“{ad.quoteEn || ad.quote}”</blockquote><figcaption>{ad.titleEn || ad.title} · <a href={ad.url} target="_blank" rel="noreferrer">Source ad ↗</a></figcaption></figure>)}<p className="marketing-source-date">Sample: {selected.company.jobAds.manual}/{selected.company.jobAds.checked} ads flagged · Retrieved {selected.company.jobAds.fetchedAt}</p></section>
          <div className="marketing-analysis-footer"><a href={`/brief/${selected.company.id}`} target="_blank" rel="noreferrer">Read full company brief ↗</a><button className="btn btn-dark btn-sm" onClick={() => { ensureDraft(selected); setTab("email"); }}>Draft an email<Icon name="arrowRight" /></button></div>
        </div> : draft && <form className="marketing-composer" onSubmit={(event) => { event.preventDefault(); simulateSend(); }}>
          <p className="marketing-composer-notice"><Icon name="lock" /> Demo email. No delivery.</p>
          <label>To<input type="email" required disabled={simulated[selected.company.id] || busy} value={draft.to} onChange={(event) => updateDraft({ to: event.target.value })} autoComplete="off" /></label>
          <p className="marketing-recipient-note">Suggested inbox · verify. <a href={selected.contacts.contactPageSearch} target="_blank" rel="noreferrer">Contacts ↗</a></p>
          <label>Subject<input required disabled={simulated[selected.company.id] || busy} maxLength={300} value={draft.subject} onChange={(event) => updateDraft({ subject: event.target.value })} /></label>
          <details className="email-edit-message"><summary>Edit message</summary><label><span className="sr-only">Message</span><textarea required disabled={simulated[selected.company.id] || busy} value={draft.body} onChange={(event) => updateDraft({ body: event.target.value })} rows={10} /></label></details>
          <section className="invitation-preview"><h3>Email preview</h3><div className="email-rendered-preview" dangerouslySetInnerHTML={{ __html: invitationEmailHtml(draft, draft.links) }} /></section>
          {simulated[selected.company.id] && <p className="marketing-send-confirmation" role="status"><Icon name="check" /> Demo complete. No email was sent to {draft.to}.</p>}
          {copyError && <p role="status" className="text-xs text-ink-3">Rich-text copying is unavailable. Download the HTML email to keep its buttons.</p>}
          <div className="marketing-compose-actions"><button type="button" onClick={copyDraft}>{copied ? "Email copied" : "Copy email"}</button><button type="button" onClick={downloadEmail}>Download HTML</button><button type="button" disabled={busy} onClick={() => ensureDraft(selected, true)}>New invitation</button><button type="submit" disabled={busy || simulated[selected.company.id]} className="btn btn-dark btn-sm" aria-describedby="marketing-send-explanation">{busy ? "Saving…" : simulated[selected.company.id] ? "Demo recorded" : "Send demo"}<Icon name="arrowRight" /></button></div>
          <p id="marketing-send-explanation" className="marketing-send-explanation">Saves a demo invitation for response tracking. No email is delivered. </p>
        </form>}
        {tab === "email" && !draft && <p className="marketing-analysis">{busy ? "Preparing invitation…" : <button onClick={() => ensureDraft(selected)}>Prepare invitation</button>}</p>}
        {error && <p role="alert" className="marketing-analysis">{error}</p>}
      </>}
    </dialog>
  </main>;
}
