"use server";

import { requireDashboardLogin } from "@/lib/dashboard/auth";
import { getDashboardCompanies, dashboardUsesSupabase } from "@/lib/dashboard/job-ads";
import { findTargets } from "@/lib/outreach/targets";
import { roleSolution } from "@/lib/case/solution";
import { contactSheet } from "@/lib/outreach/contacts";

export async function fetchJobAds() {
  await requireDashboardLogin();
  try {
    if (!dashboardUsesSupabase()) throw new Error("Add SUPABASE_URL and SUPABASE_SECRET_KEY to the app environment to load saved job ads.");
    const data = await getDashboardCompanies();
    const prospects = findTargets(data.companies).map((target) => ({ company: target.company, score: target.score, tier: target.tier, staffing: target.staffing, solution: roleSolution(target.company), contacts: contactSheet(target.company) }));
    const checked = data.companies.reduce((sum, company) => sum + company.jobAds.checked, 0);
    return { ok: true, message: `Loaded ${checked} saved ads across ${data.companies.length} companies; ${prospects.length} companies have flagged opportunities.`, data: { prospects, totalCompanies: data.companies.length, updatedAt: data.updatedAt, automatic: data.automatic, lastRefreshError: data.lastError } };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not update job ads. Existing data was kept." };
  }
}
