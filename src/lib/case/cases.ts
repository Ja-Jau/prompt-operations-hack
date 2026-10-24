import type { HiringCompany, JobAd } from "@/types/company";
import { dailyNumber, todayKey } from "@/lib/game/daily";
import { seededRandom } from "@/lib/game/random";

/** A company needs this many verified quotes to be a case. Keep in sync with pipeline/import_jobs.py. */
export const MIN_CASE_QUOTES = 2;
/** Six options: at most five misses before the answer is the only card left. */
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

/** Each clue has a playful title, e.g. "Exhibit A", so unlocking one feels like opening a file. */
export type Clue = { kind: "quote"; title: string; ad: JobAd } | { kind: "fact"; title: string; value: string };

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * The clues in reveal order: one at the start, one more per wrong pick or analyst tip.
 * Ordered so each one helps tell the six options apart.
 */
export function caseClues(company: HiringCompany): Clue[] {
  const [a, b, c] = company.jobAds.ads;
  const otherTitles = company.titles.filter((t) => t !== a.title && t !== b.title).slice(0, 3);
  const cities = company.locations.slice(0, 3).join(", ") || "Finland";
  const open = plural(company.jobAds.checked, "open role", "open roles");

  const exhibitC: Clue = c
    ? { kind: "quote", title: "Exhibit C", ad: c }
    : { kind: "fact", title: "Also on their job board", value: otherTitles.map((t) => redact(t, company)).join(" · ") || open };

  return [
    { kind: "quote", title: "Exhibit A", ad: a },
    { kind: "fact", title: "The hiring map", value: `${open} in ${cities}` },
    { kind: "quote", title: "Exhibit B", ad: b },
    { kind: "fact", title: "What they hire for", value: company.functions.join(" · ") },
    ...(company.velhoCase
      ? [{ kind: "fact" as const, title: "Velho analyst's note", value: redact(company.velhoCase.analystHint, company) }]
      : []),
    exhibitC,
  ];
}

export const OPTION_COUNT = 6;

/**
 * The six cards for a case: the answer, three look-alikes that hire for similar roles in similar
 * places, and two better-known companies. Seeded by the case, so everyone sees the same six.
 */
export function caseOptions(target: HiringCompany, pool: HiringCompany[], ranks: Map<string, number>): HiringCompany[] {
  const rand = seededRandom(`options-${target.id}`);
  const pick = (from: HiringCompany[], n: number) => {
    const copy = [...from];
    const out: HiringCompany[] = [];
    while (out.length < n && copy.length) out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]);
    return out;
  };
  const others = pool.filter((c) => c.id !== target.id);
  const lookalikes = pick(
    [...others].sort((a, b) => (ranks.get(a.id) ?? 0) - (ranks.get(b.id) ?? 0)).slice(0, 10),
    3,
  );
  const taken = new Set([target.id, ...lookalikes.map((c) => c.id)]);
  const wellKnown = pick(
    others.filter((c) => !taken.has(c.id) && c.jobAds.checked >= 2),
    OPTION_COUNT - 1 - lookalikes.length,
  );
  return pick([target, ...lookalikes, ...wellKnown], OPTION_COUNT);
}

export type Direction = "up" | "down" | "same";

export type Feedback = {
  company: HiringCompany;
  correct: boolean;
  /** Cities both companies hire in, e.g. ["Tampere"]. */
  sharedCities: string[];
  /** Job functions both companies hire for, e.g. ["Finance"]. */
  sharedRoles: string[];
  /** Whether the answer has more (up) or fewer (down) open ads than the guess. */
  openRoles: Direction;
  /** 1 = the answer; lower is closer. Ranked among every guessable company. */
  rank: number;
  /** 0–1, 1 = the answer. Used for the warm/cold marks in the share text. */
  closeness: number;
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
  const rank = ranks.get(guess.id) ?? ranks.size;
  return {
    company: guess,
    correct: guess.id === target.id,
    sharedCities: guess.locations.filter((city) => target.locations.includes(city)),
    sharedRoles: guess.functions.filter((role) => target.functions.includes(role)),
    openRoles: diff === 0 ? "same" : diff > 0 ? "up" : "down",
    rank,
    closeness: ranks.size > 1 ? 1 - (rank - 1) / (ranks.size - 1) : 1,
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
  // ✓ found it, ● warm guess, ○ cold guess. Plain symbols, no emoji, no spoilers.
  const grid = opts.feedback.map((f) => (f.correct ? "✓" : f.closeness >= 0.6 ? "●" : "○")).join(" ");
  const score = opts.solved ? `Solved in ${opts.feedback.length}/${MAX_GUESSES}` : `Not solved (${MAX_GUESSES}/${MAX_GUESSES})`;
  const fix =
    opts.fixedRight === null ? "" : opts.fixedRight ? "\nSame first fix as Velho" : "\nVelho would fix it differently";
  return `Who's hiring? ${opts.label}\n${score}\n${grid}${fix}\n${opts.url}`;
}
