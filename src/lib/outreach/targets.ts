import type { HiringCompany } from "@/types/company";
import { firstFix, serviceFor } from "@/lib/signals";
import { shortName } from "@/lib/case/cases";

/**
 * Step 1 of the outreach pipeline: find the companies worth talking to.
 *
 * Everything here is computed from data already in the repo (src/data/hiring.json and the
 * pipeline catalog). No network calls, no AI at request time, so the dashboard loads instantly
 * and every reason shown can be traced back to a job ad.
 */

export type Tier = "hot" | "warm" | "watch";

export type Target = {
  company: HiringCompany;
  /** 0–100. Higher means more, and clearer, routine work in open ads. */
  score: number;
  tier: Tier;
  /** Plain-language reasons the company made the list, strongest first. */
  reasons: string[];
  /** True for recruiters and staffing agencies: the ad describes a client's work, not theirs. */
  staffing: boolean;
  /** The first thing Velho would fix, from the curated case, or null. */
  firstFix: string | null;
  /** Which Velho service area the first fix belongs to, or null. */
  serviceArea: string | null;
  /** Whether the company has enough curated quotes to be a Who's hiring? case. */
  isCase: boolean;
};

/** Words in a company name that mean "we hire for other companies". */
const STAFFING = /\b(barona|adecco|academic work|staffpoint|eezy|eilakaisla|workpower|manpower|go on|henkilöstö|rekry|recruit|staffing|personnel|vmp|sihti|alrekry|luotea|rainmaker|aaltovoima)\b/i;

/** Public-sector bodies: still valid targets, but the buyer and the sales cycle differ. */
const PUBLIC = /\b(kaupunki|kunta|yliopisto|hus|kela|valtio|tilakeskus|hyvinvointialue|sairaanhoitopiiri)\b/i;

export function isStaffing(company: Pick<HiringCompany, "name">): boolean {
  return STAFFING.test(company.name);
}

export function isPublicSector(company: Pick<HiringCompany, "name">): boolean {
  return PUBLIC.test(company.name);
}

/** Clamp a number into 0–100. */
const pct = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/**
 * Score one company. The weights are deliberately simple so a person at Velho can read the
 * reasons and agree or disagree; this is a shortlist, not a verdict.
 */
export function scoreTarget(company: HiringCompany): Target {
  const { manual, checked, ads } = company.jobAds;
  const share = checked > 0 ? manual / checked : 0;
  const staffing = isStaffing(company);
  const publicSector = isPublicSector(company);
  const fix = firstFix(company);
  const service = serviceFor(company);
  const reasons: string[] = [];

  // Volume of routine work: each manual-work ad is a concrete conversation opener.
  let score = Math.min(40, manual * 12);
  if (manual >= 2) reasons.push(`${manual} open ${manual === 1 ? "role" : "roles"} describe routine work software could take over`);
  else if (manual === 1) reasons.push("1 open role describes routine work software could take over");

  // Share: a high share with a decent sample means it's a pattern, not one ad.
  if (checked >= 3) {
    score += Math.min(25, share * 40);
    if (share >= 0.3) reasons.push(`${Math.round(share * 100)}% of ${checked} open ads mention routine tasks`);
  } else if (checked > 0) {
    score += share * 10;
  }

  // Breadth: many cities or functions means the routine work is spread across the organisation.
  if (company.locations.length >= 5) {
    score += 10;
    reasons.push(`Hiring in ${company.locations.length} locations, so one fix repeats across sites`);
  }
  if (company.functions.length >= 3) {
    score += 5;
    reasons.push(`Routine work spans ${company.functions.length} functions: ${company.functions.slice(0, 3).join(", ")}`);
  }

  // A curated Velho take means the opener can name the first fix.
  if (fix) {
    score += 15;
    reasons.push(`Velho's take is ready: start with "${fix}"`);
  }

  // Recognisable brand: a logo or domain on file means the company is established enough to buy.
  if (company.logo || company.domain) {
    score += 5;
    reasons.push("Established company with a known web presence");
  }

  // Staffing agencies: the work belongs to an undisclosed client, so the opener would land wrong.
  if (staffing) {
    score *= 0.4;
    reasons.push("Staffing agency: the ads describe clients' work, so approach as a channel partner, not a buyer");
  }
  if (publicSector) {
    score *= 0.85;
    reasons.push("Public sector: longer procurement, but routine work is well documented");
  }

  const final = pct(score);
  const tier: Tier = final >= 60 ? "hot" : final >= 35 ? "warm" : "watch";

  return {
    company,
    score: final,
    tier,
    reasons,
    staffing,
    firstFix: fix,
    serviceArea: service?.title ?? null,
    isCase: ads.length >= 2,
  };
}

/** Every company with at least one routine-work ad, best target first. */
export function findTargets(companies: HiringCompany[]): Target[] {
  return companies
    .filter((c) => c.jobAds.manual > 0 && c.jobAds.ads.length > 0)
    .map(scoreTarget)
    .sort((a, b) => b.score - a.score || b.company.jobAds.manual - a.company.jobAds.manual || a.company.name.localeCompare(b.company.name));
}

export const TIER_LABEL: Record<Tier, string> = {
  hot: "Hot",
  warm: "Warm",
  watch: "Watch",
};

/** The company as you'd say it in an email: no "Oy" or "Oyj". */
export function displayName(company: Pick<HiringCompany, "name">): string {
  return shortName(company);
}
