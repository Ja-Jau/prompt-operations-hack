export type Company = {
  id: string;
  name: string;
  industry: string;
  revenueEurM: number;
  employees: number;
  fiscalYear: number;
  domain: string | null;
  /** Used for the initials fallback when no logo loads. */
  brandColor: string;
  /** Public path under /logos, or null to fall back to a logo service, then initials. */
  logo: string | null;
  /** Background photo under /images: the company's own, else its industry's, else null. */
  image: string | null;
  imageCredit: { author: string; url: string; source: string; license: string | null } | null;
  sourceUrl: string | null;
  /** True once the figures have been checked against the company's annual report. */
  verified: boolean;
  /** Shown as the "Velho insight": why revenue per employee is high or low. */
  why: string;
  /** Shown by the "Ask Velho" lifeline: what the company does, without naming numbers. */
  hint: string;
  /** Open job ads read by pipeline/fetch_job_ads.py, or null if not checked yet. */
  jobAds: JobAds | null;
  /** Velho's take for the daily case (pipeline/build_cases.py), or null. */
  velhoCase: VelhoCase | null;
  /** Sourced observations from pipeline/fetch_efficiency.py; missing means unavailable. */
  efficiency?: Partial<Record<EfficiencyMetricId, EfficiencyObservation>>;
};

export type EfficiencyMetricId = "growthGap" | "manualAds" | "adminRatio" | "inventoryDays";

export type EfficiencyObservation = {
  value: number;
  year: number | null;
  period: string;
  scope: string;
  definition: string;
  fetchedAt: string;
  sources: { url: string; label: string; evidence: string }[];
  inputs: Record<string, number>;
  note: string;
};

/**
 * A company with open job ads (src/data/hiring.json, from pipeline/import_jobs.py). Only what the
 * ads themselves show: no revenue or headcount, which the ads don't contain.
 */
export type HiringCompany = {
  id: string;
  name: string;
  domain: string | null;
  brandColor: string;
  logo: string | null;
  image: string | null;
  imageCredit: Company["imageCredit"];
  /** Cities named in the ads. */
  locations: string[];
  /** Job functions the ads are filed under, e.g. "Procurement". */
  functions: string[];
  /** Titles of every open ad. */
  titles: string[];
  /** The same titles in English (pipeline/data/translations.json), in the same order. */
  titlesEn: string[];
  jobAds: JobAds;
  velhoCase: VelhoCase | null;
  /** The same company in Higher or lower, if it's there. */
  gameCompanyId: string | null;
  /** A playful hint for the daily case (pipeline/data/fun_hints.json), or null. */
  funHint: string | null;
};

export type JobAd = {
  title: string;
  /** Verbatim from the ad, in its own language. */
  quote: string;
  url: string;
  /** English for the game; the same as the original when the ad was in English. */
  titleEn: string;
  quoteEn: string;
};

export type JobAds = {
  /** Open ads that were read. */
  checked: number;
  /** Of those, ads describing manual, repetitive work (Excel upkeep, data entry, "käsin", ...). */
  manual: number;
  /** The manual-work ads, each with a verbatim quote. */
  ads: JobAd[];
  source: string;
  fetchedAt: string;
};

export type VelhoCase = {
  /** The "Ask Velho" lifeline: a pattern an analyst would spot across the ads. */
  analystHint: string;
  fixOptions: string[];
  correctIndex: number;
  fixReasoning: string;
  adoptNote: string;
  /** Which of Velho's service areas (src/lib/velho.ts) the first fix belongs to. */
  serviceArea?: string;
};

export type Lead = {
  id: string;
  name: string;
  email: string;
  company: string;
  /** Where the lead came from, e.g. "case-reveal" or "brief". */
  source: string;
  /** The case or brief company the player was looking at. */
  contextCompanyId: string | null;
  createdAt: string;
};

export type Mode = "daily" | "endless";

/** A company the player looked up for "Where does your company rank?". */
export type LookupResult = {
  name: string;
  industry: string;
  revenueEurM: number;
  employees: number;
  fiscalYear: number;
  why: string;
  sources: string[];
  /** "dataset": already in the game. "ai": found by Claude with web search. */
  origin: "dataset" | "ai";
};

/** Display identity and sourced observations; unknown financial totals are not invented. */
export type GameCompany = Pick<Company,
  "id" | "name" | "industry" | "domain" | "brandColor" | "logo" | "image" | "imageCredit" | "hint" | "efficiency"
>;
