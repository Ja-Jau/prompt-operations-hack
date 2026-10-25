import type { Metadata } from "next";
import { getDashboardCompanies } from "@/lib/dashboard/job-ads";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { dashboardProspects } from "@/lib/dashboard/prospects";
import { requireDashboardLogin } from "@/lib/dashboard/auth";
import { MarketingDashboard } from "@/components/dashboard/MarketingDashboard";

export const metadata: Metadata = { title: "Marketing dashboard | Velho" };
export const dynamic = "force-dynamic";

/** Marketing opportunities and draft emails. Delivery is simulated; invitation responses persist. */
export default async function VelhoDashboard() {
  await requireDashboardLogin();
  const { companies, updatedAt, automatic, lastError } = await getDashboardCompanies();
  const prospects = dashboardProspects(companies);
  return <div className="marketing-page min-h-dvh bg-cream">
    <DashboardHeader active="opportunities" />
    <MarketingDashboard prospects={prospects} totalCompanies={companies.length} updatedAt={updatedAt} automatic={automatic} lastRefreshError={lastError} />
  </div>;
}
