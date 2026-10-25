"use server";

import { requireDashboardLogin } from "@/lib/dashboard/auth";
import { getDashboardCompanies, dashboardUsesSupabase } from "@/lib/dashboard/job-ads";
import { dashboardProspects } from "@/lib/dashboard/prospects";

export async function fetchJobAds() {
  await requireDashboardLogin();
  try {
    if (!dashboardUsesSupabase()) throw new Error("Add SUPABASE_URL and SUPABASE_SECRET_KEY to the app environment to load saved job ads.");
    const data = await getDashboardCompanies();
    const prospects = dashboardProspects(data.companies);
    const checked = data.companies.reduce((sum, company) => sum + company.jobAds.checked, 0);
    const flagged = prospects.filter((prospect) => prospect.company.jobAds.manual > 0).length;
    return { ok: true, message: `Loaded ${checked} saved ads. All ${prospects.length} companies are listed below; ${flagged} have flagged opportunities.`, data: { prospects, totalCompanies: data.companies.length, updatedAt: data.updatedAt, automatic: data.automatic, lastRefreshError: data.lastError } };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not update job ads. Existing data was kept." };
  }
}
