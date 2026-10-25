import type { Metadata } from "next";
import { headers } from "next/headers";
import { getDashboardCompanies } from "@/lib/dashboard/job-ads";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { dailyCase } from "@/lib/case/cases";
import { roleSolution } from "@/lib/case/solution";
import { readLeads } from "@/lib/leads";
import { linkedInPost } from "@/lib/signals";
import { findTargets } from "@/lib/outreach/targets";
import { contactSheet } from "@/lib/outreach/contacts";
import { CopyButton } from "@/components/ui/CopyButton";
import { requireDashboardLogin } from "@/lib/dashboard/auth";
import { MarketingDashboard } from "@/components/dashboard/MarketingDashboard";

export const metadata: Metadata = { title: "Marketing dashboard | Velho" };
export const dynamic = "force-dynamic";

/** Marketing opportunities and draft emails. Delivery is simulated; invitation responses persist. */
export default async function VelhoDashboard() {
  await requireDashboardLogin();
  const { companies, updatedAt } = await getDashboardCompanies();
  const leads = await readLeads();
  const prospects = findTargets(companies).map((target) => ({
    company: target.company, score: target.score, tier: target.tier, staffing: target.staffing,
    solution: roleSolution(target.company), contacts: contactSheet(target.company),
  }));
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const today = dailyCase(companies);
  const post = today ? linkedInPost(today, origin) : "";
  return <div className="marketing-page min-h-dvh bg-cream">
    <DashboardHeader active="opportunities" />
    <MarketingDashboard prospects={prospects} totalCompanies={companies.length} leadCount={leads.length} updatedAt={updatedAt} />
    <div className="marketing-secondary">
      <details><summary>Player enquiries <span>{leads.length}</span></summary>{leads.length ? <ul>{leads.slice(0, 20).map((lead) => <li key={lead.id}><strong>{lead.name} · {lead.company}</strong><span>{lead.email}</span><small>{new Date(lead.createdAt).toLocaleDateString("en-GB")} · {lead.source}</small></li>)}</ul> : <p>No enquiries yet. Requests from the game will appear here.</p>}</details>
      {post && <details><summary>LinkedIn draft</summary><pre>{post}</pre><CopyButton text={post} label="Copy LinkedIn draft" /></details>}
    </div>
  </div>;
}
