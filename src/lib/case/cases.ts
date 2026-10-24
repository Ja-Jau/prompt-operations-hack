import type { HiringCompany, JobAd } from "@/types/company";
import { dailyNumber, todayKey } from "@/lib/game/daily";
import { seededRandom } from "@/lib/game/random";

/** A company needs this many verified quotes to be a case. Keep in sync with pipeline/import_jobs.py. */
export const MIN_CASE_QUOTES = 2;
/** Picks per case. With more cards than picks, a case can be lost. */
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

/** Matches any whole word containing `part`, e.g. "Nostokonepalveluille" for "Nostokonepalvelu". */
function wordContaining(part: string): RegExp {
  const escaped = part.replace(/[.*+?^$|()[\]{}\\]/g, "\\$&");
  const word = "[\\p{L}\\d'’:-]*";
  return new RegExp(word + escaped + word, "giu");
}

/**
 * Takes the company's name out of a quote or title, so the clue doesn't give the answer away.
 * Whole words go, Finnish endings included ("Nostokonepalveluille"), so no gap is left behind.
 */
export function redact(text: string, company: Pick<HiringCompany, "name">): string {
  const base = shortName(company);
  const names = [company.name, base, ...base.split(/[\s&–-]+/)].filter((w) => w.length >= 3);
  const removed = names.reduce((out, name) => out.replace(wordContaining(name), ""), text);
  return removed
    .replace(/\s+([,.;:!?)])/g, "$1")
    .replace(/\(\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,–-]+|[\s,–-]+$/g, "");
}

/**
 * A clue, each kind with its own look: a job-ad quote, the hiring map, role or title chips,
 * or a note from a Velho analyst. Titles are playful so unlocking one feels like opening a file.
 */
export type Clue =
  | { kind: "quote"; title: string; ad: JobAd }
  | { kind: "map"; title: string; openRoles: number; cities: string[] }
  | { kind: "chips"; title: string; items: string[] }
  | { kind: "analyst"; title: string; note: string }
  | { kind: "fact"; title: string; text: string };

/** The last clue: the name's first letter and length, so the final pick is always winnable. */
function nameClue(company: HiringCompany): Clue {
  const words = shortName(company).split(/\s+/).filter((w) => /\p{L}/u.test(w));
  const letters = words.join("").replace(/[^\p{L}]/gu, "").length;
  const shape = words.length === 1 ? `${letters} letters` : `${words.length} words, ${letters} letters`;
  return { kind: "fact", title: "Their name", text: `Starts with “${words[0][0].toUpperCase()}”, ${shape}` };
}

/**
 * The clues in reveal order: one at the start, one more per wrong pick or free clue.
 * All from the job ads themselves, going from the quote to things anyone can place (the jobs,
 * the cities), ending with the name's first letter so the last pick is always winnable.
 */
export function caseClues(company: HiringCompany): Clue[] {
  const [a, b] = company.jobAds.ads;
  return [
    { kind: "quote", title: "From a job ad", ad: a },
    { kind: "chips", title: "Jobs they're hiring for", items: company.titles.slice(0, 4).map((t) => redact(t, company)) },
    { kind: "map", title: "Where they hire", openRoles: company.jobAds.checked, cities: company.locations.slice(0, 4) },
    { kind: "quote", title: "Another of their job ads", ad: b },
    { kind: "chips", title: "What they hire for", items: company.functions },
    nameClue(company),
  ];
}

/**
 * Words in a job ad that point at routine work, highlighted in quotes so the manual work jumps out.
 * Finnish and English stems; matched case-insensitively inside longer words.
 */
export const ROUTINE_WORK =
  /[\p{L}-]*(kirjau|kirjaa|laskut|laskuj|tilau|tilaus|ylläpi|päivit|raport|syöt|tarkast|käsittel|täsmäy|reskontr|tiliöin|arkistoi|dokumen|ajanvara|lähete|palkka-aineist|aineisto)\p{L}*|(?<!\p{L})(ERP|Excel|Salesforce|CRM|orders?|invoices?|reconciliations?|validating|processing|documentation|manual|repetitive|data)(?!\p{L})/giu;

export const OPTION_COUNT = 9;

/**
 * The cards for a case: the answer, look-alikes that hire for similar roles in similar places, and
 * better-known companies. Seeded by the case, so everyone sees the same cards.
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
    [...others].sort((a, b) => (ranks.get(a.id) ?? 0) - (ranks.get(b.id) ?? 0)).slice(0, 12),
    Math.floor((OPTION_COUNT - 1) / 2),
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
  url: string;
}): string {
  // ✓ found it, ● warm guess, ○ cold guess. Plain symbols, no emoji, no spoilers.
  const grid = opts.feedback.map((f) => (f.correct ? "✓" : f.closeness >= 0.6 ? "●" : "○")).join(" ");
  const score = opts.solved ? `Solved in ${opts.feedback.length}/${MAX_GUESSES}` : `Not solved (${MAX_GUESSES}/${MAX_GUESSES})`;
  return `Who's hiring? ${opts.label}\n${score}\n${grid}\n${opts.url}`;
}
