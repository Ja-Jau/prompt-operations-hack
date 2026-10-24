import companies from "@/data/companies.json";
import type { Company } from "@/types/company";

/**
 * Single entry point for company data. Today it reads the JSON exported by
 * pipeline/build.py; swap the body for a live API or database later and
 * every caller keeps working.
 */
export async function getCompanies(): Promise<Company[]> {
  return companies as Company[];
}
