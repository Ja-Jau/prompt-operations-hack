import type { HiringCompany, JobAd } from "@/types/company";
import { dailyNumber, todayKey } from "@/lib/game/daily";
import { seededRandom } from "@/lib/game/random";

/** A company needs this many verified quotes to be a case. Keep in sync with pipeline/import_jobs.py. */
export const MIN_CASE_QUOTES = 2;
export const MAX_GUESSES = 6;

const LEGAL_SUFFIX = /\s*\b(oyj|oy|ab|ltd|inc|gmbh|abp|ry)\b\.?/gi;

export function caseCompanies(companies: HiringCompany[]): HiringCompany[] {
  return companies
    .filter((c) => c.jobAds.ads.length >= MIN_CASE_QUOTES)
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** Today's case: the same company for everyone, cycling through every case before repeating. */
export function dailyCase(companies: HiringCompany[], key = todayKey()): HiringCompany | null {
  const pool = caseCompanies(companies);
  if (pool.length === 0) return null;
  const rand = seededRandom("tehokas-cases");
  const order = [...pool];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order[(dailyNumber(key) - 1) % order.length];
}

/** The name without "Oy", "Oyj" and similar, as people say it. */
export function shortName(company: Pick<HiringCompany, "name">): string {
  return company.name.replace(LEGAL_SUFFIX, "").trim();
}

/** Hides the company's name in a quote, so the clue doesn't give the answer away. */
export function redact(text: string, company: Pick<HiringCompany, "name">): string {
  const base = shortName(company);
  const names = [company.name, base, ...base.split(/[\s&–-]+/)].filter((w) => w.length >= 3);
  return names.reduce(
    (out, name) => out.replace(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "▇▇▇"),
    text,
  );
}

export type Clue =
  | { kind: "quote"; ad: JobAd }
  | { kind: "fact"; label: string; value: string };

/** The six clues in reveal order: one at the start, one more after each wrong guess. */
export function caseClues(company: HiringCompany): Clue[] {
  const [a, b, c] = company.jobAds.ads;
  const otherTitles = company.titles.filter((t) => t !== a.title && t !== b.title).slice(0, 3);
  const third: Clue = c
    ? { kind: "quote", ad: c }
    : otherTitles.length > 0
      ? { kind: "fact", label: "Also hiring", value: otherTitles.map((t) => redact(t, company)).join(" · ") }
      : { kind: "fact", label: "Open roles", value: String(company.jobAds.checked) };
  const base = shortName(company);
  return [
    { kind: "quote", ad: a },
    { kind: "quote", ad: b },
    third,
    { kind: "fact", label: "Hiring for", value: company.functions.join(" · ") },
    { kind: "fact", label: "Located in", value: company.locations.slice(0, 4).join(" · ") || "Finland" },
    { kind: "fact", label: "Name", value: `Starts with “${base[0]}”, ${base.length} characters` },
  ];
}

export type Direction = "up" | "down" | "same";

export type Feedback = {
  company: HiringCompany;
  correct: boolean;
  /** Hires in at least one of the same cities. */
  sameCity: boolean;
  /** Hires for at least one of the same job functions. */
  sameRoles: boolean;
  /** Whether the answer has more (up) or fewer (down) open ads than the guess. */
  openRoles: Direction;
  /** 1 = the answer; lower is closer. Ranked among every guessable company. */
  rank: number;
};

function overlap(a: string[], b: string[]): number {
  const set = new Set(a);
  const shared = b.filter((x) => set.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : shared / union;
}

/** How alike two companies' hiring looks, 0–1: same roles, same cities, similar number of open ads. */
function similarity(a: HiringCompany, b: HiringCompany): number {
  if (a.id === b.id) return 2;
  const ratio = Math.min(a.jobAds.checked, b.jobAds.checked) / Math.max(a.jobAds.checked, b.jobAds.checked);
  return 0.4 * overlap(a.functions, b.functions) + 0.35 * overlap(a.locations, b.locations) + 0.25 * ratio;
}

/** Rank of every company by closeness to the answer: the answer is 1. */
export function closenessRanks(pool: HiringCompany[], target: HiringCompany): Map<string, number> {
  const sorted = [...pool].sort((a, b) => similarity(b, target) - similarity(a, target));
  return new Map(sorted.map((c, i) => [c.id, i + 1]));
}

export function compare(guess: HiringCompany, target: HiringCompany, ranks: Map<string, number>): Feedback {
  const diff = target.jobAds.checked - guess.jobAds.checked;
  return {
    company: guess,
    correct: guess.id === target.id,
    sameCity: overlap(guess.locations, target.locations) > 0,
    sameRoles: overlap(guess.functions, target.functions) > 0,
    openRoles: diff === 0 ? "same" : diff > 0 ? "up" : "down",
    rank: ranks.get(guess.id) ?? ranks.size,
  };
}

export function caseShareText(opts: {
  /** "Case No. 3" or "Practice case". */
  label: string;
  feedback: Feedback[];
  solved: boolean;
  fixedRight: boolean | null;
  url: string;
}): string {
  // ✓ found it, ~ hiring for similar roles, × miss. Plain symbols, no emoji, no spoilers.
  const grid = opts.feedback.map((f) => (f.correct ? "✓" : f.sameRoles ? "~" : "×")).join(" ");
  const score = opts.solved ? `Solved in ${opts.feedback.length}/${MAX_GUESSES}` : `Not solved (${MAX_GUESSES}/${MAX_GUESSES})`;
  const fix =
    opts.fixedRight === null ? "" : opts.fixedRight ? "\nSame first fix as Velho" : "\nVelho would fix it differently";
  return `Who's hiring? ${opts.label}\n${score}\n${grid}${fix}\n${opts.url}`;
}
