import companies from "@/data/companies.json";
import exampleCases from "@/data/example-cases.json";
import type { Company } from "@/types/company";

/**
 * Single entry point for company data. Today it reads the JSON exported by
 * pipeline/build.py; swap the body for a live API or database later and
 * every caller keeps working.
 */
export async function getCompanies(): Promise<Company[]> {
  return companies as Company[];
}

/** Made-up companies with made-up job ads, used for the daily case until real data exists. */
export async function getExampleCompanies(): Promise<Company[]> {
  const real = await getCompanies();
  // Borrow the industry background photo (and its credit) from a real company.
  return (exampleCases as Company[]).map((example) => {
    const sameIndustry = real.find((c) => c.industry === example.industry && c.image);
    return { ...example, image: sameIndustry?.image ?? null, imageCredit: sameIndustry?.imageCredit ?? null };
  });
}
