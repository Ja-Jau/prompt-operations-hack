import companies from "@/data/game_companies.json";
import hiring from "@/data/hiring.json";
import efficiency from "@/data/efficiency.json";
import { companyPhotoFallback } from "./company-images";
import type { GameCompany, EfficiencyMetricId, EfficiencyObservation, HiringCompany } from "@/types/company";

/** Automatically discovered company identities, joined to the latest published observations. */
export async function getCompanies(): Promise<GameCompany[]> {
  const observations = efficiency as Record<string, { metrics: Partial<Record<EfficiencyMetricId, EfficiencyObservation>> }>;
  return (companies as GameCompany[]).map((company) => ({
    ...company,
    ...(company.image ? {} : companyPhotoFallback(company)),
    efficiency: observations[company.id]?.metrics ?? {},
  }));
}

/** Every company with open job ads, from pipeline/import_jobs.py. */
export async function getHiringCompanies(): Promise<HiringCompany[]> {
  return hiring as HiringCompany[];
}
