import companies from "@/data/companies.json";
import hiring from "@/data/hiring.json";
import efficiency from "@/data/efficiency.json";
import type { Company, EfficiencyMetricId, EfficiencyObservation, HiringCompany } from "@/types/company";

/**
 * Single entry point for company data. Today it reads the JSON exported by
 * pipeline/build.py; swap the body for a live API or database later and
 * every caller keeps working.
 */
export async function getCompanies(): Promise<Company[]> {
  const observations = efficiency as Record<string, { metrics: Partial<Record<EfficiencyMetricId, EfficiencyObservation>> }>;
  return (companies as Company[]).map((company) => ({
    ...company,
    efficiency: observations[company.id]?.metrics ?? {},
  }));
}

/** Every company with open job ads, from pipeline/import_jobs.py. */
export async function getHiringCompanies(): Promise<HiringCompany[]> {
  return hiring as HiringCompany[];
}
