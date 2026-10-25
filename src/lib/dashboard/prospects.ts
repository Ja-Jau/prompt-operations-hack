import type { HiringCompany } from "@/types/company";
import { scoreTarget } from "@/lib/outreach/targets";
import { contactSheet } from "@/lib/outreach/contacts";
import { roleSolution } from "@/lib/case/solution";

/** Show every saved company; keyword matches rank opportunities rather than gate visibility. */
export function dashboardProspects(companies: HiringCompany[]) {
  return companies.map(scoreTarget)
    .sort((a, b) => Number(b.company.jobAds.manual > 0) - Number(a.company.jobAds.manual > 0)
      || b.score - a.score || a.company.name.localeCompare(b.company.name))
    .map((target) => {
      const solution = roleSolution(target.company);
      return {
        company: target.company, score: target.score, tier: target.tier, staffing: target.staffing,
        contacts: contactSheet(target.company),
        solution: target.company.jobAds.manual ? solution : {
          ...solution, area: "Needs review",
          action: "Review the saved job listings before proposing an improvement.",
          reasoning: "No explicit repetitive-task phrase was flagged in this company's saved ad sample.",
          people: "A person should confirm whether these roles include work suitable for automation.",
        },
      };
    });
}
