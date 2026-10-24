import type { Company, JobAd } from "@/types/company";
import { dailyNumber, todayKey } from "@/lib/game/daily";
import { seededRandom } from "@/lib/game/random";
import { revenuePerEmployee } from "@/lib/game/rules";

/** A company needs this many manual-work quotes to be a case. Keep in sync with the pipeline. */
export const MIN_CASE_QUOTES = 3;
export const MAX_GUESSES = 6;

export function caseCompanies(companies: Company[]): Company[] {
  return companies
    .filter((c) => (c.jobAds?.ads.length ?? 0) >= MIN_CASE_QUOTES)
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** Today's case: the same company for everyone, cycling through every case before repeating. */
export function dailyCase(companies: Company[], key = todayKey()): Company | null {
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

/** Hides the company's name in a quote, so the clue doesn't give the answer away. */
export function redact(text: string, company: Company): string {
  const names = [company.name, ...company.name.split(/\s+/)].filter((w) => w.length >= 3);
  return names.reduce(
    (out, name) => out.replace(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "▇▇▇"),
    text,
  );
}

export type Clue =
  | { kind: "quote"; ad: JobAd }
  | { kind: "fact"; label: string; value: string }
  | { kind: "logo" };

function roughly(n: number): string {
  const digits = Math.max(0, Math.floor(Math.log10(n)) - 1);
  const rounded = Math.round(n / 10 ** digits) * 10 ** digits;
  return `≈ ${rounded.toLocaleString("en")}`;
}

/** The six clues in reveal order: one at the start, one more after each wrong guess. */
export function caseClues(company: Company): Clue[] {
  const [a, b, c] = company.jobAds!.ads;
  return [
    { kind: "quote", ad: a },
    { kind: "quote", ad: b },
    { kind: "fact", label: "Industry", value: company.industry },
    { kind: "quote", ad: c },
    { kind: "fact", label: "Employees", value: roughly(company.employees) },
    { kind: "logo" },
  ];
}

export type Direction = "up" | "down" | "same";

export type Feedback = {
  company: Company;
  correct: boolean;
  sameIndustry: boolean;
  /** Whether the answer has more (up) or fewer (down) employees than the guess. */
  employees: Direction;
  /** Whether the answer earns more (up) or less (down) per employee than the guess. */
  revenuePerEmployee: Direction;
  /** 1 = the answer; lower is closer. Ranked among every guessable company. */
  rank: number;
};

function direction(target: number, guess: number): Direction {
  if (Math.abs(target - guess) / Math.max(target, guess) < 0.05) return "same";
  return target > guess ? "up" : "down";
}

/** How alike two companies are, 0–1: same industry, similar headcount, similar revenue per employee. */
function similarity(a: Company, b: Company): number {
  if (a.id === b.id) return 2;
  const ratio = (x: number, y: number) => Math.min(x, y) / Math.max(x, y);
  return (
    (a.industry === b.industry ? 0.4 : 0) +
    0.3 * ratio(a.employees, b.employees) +
    0.3 * ratio(revenuePerEmployee(a), revenuePerEmployee(b))
  );
}

/** Rank of every company by closeness to the answer: the answer is 1. */
export function closenessRanks(pool: Company[], target: Company): Map<string, number> {
  const sorted = [...pool].sort((a, b) => similarity(b, target) - similarity(a, target));
  return new Map(sorted.map((c, i) => [c.id, i + 1]));
}

export function compare(guess: Company, target: Company, ranks: Map<string, number>): Feedback {
  return {
    company: guess,
    correct: guess.id === target.id,
    sameIndustry: guess.industry === target.industry,
    employees: direction(target.employees, guess.employees),
    revenuePerEmployee: direction(revenuePerEmployee(target), revenuePerEmployee(guess)),
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
  // ✓ found it, ~ right industry, × miss. Plain symbols, no emoji, no spoilers.
  const grid = opts.feedback.map((f) => (f.correct ? "✓" : f.sameIndustry ? "~" : "×")).join(" ");
  const score = opts.solved ? `Solved in ${opts.feedback.length}/${MAX_GUESSES}` : `Not solved (${MAX_GUESSES}/${MAX_GUESSES})`;
  const fix =
    opts.fixedRight === null ? "" : opts.fixedRight ? "\nSame first fix as Velho" : "\nVelho would fix it differently";
  return `Who's hiring? ${opts.label}\n${score}\n${grid}${fix}\n${opts.url}`;
}
