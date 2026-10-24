import type { GameCompany as Company } from "@/types/company";
import { seededRandom } from "./random";
import { availableRounds, pickRound, roundKey, type Round } from "./sequence";

const LAUNCH_DATE = "2026-10-24";

export function todayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/** Puzzle number shown in the share text: #1 on launch day. */
export function dailyNumber(key = todayKey()): number {
  const days = (Date.parse(key) - Date.parse(LAUNCH_DATE)) / 86_400_000;
  return Math.max(1, Math.floor(days) + 1);
}

/**
 * Ten sourced comparisons with random categories and no repeated pair/category.
 * Date-seeded so players with the same dataset get the same daily challenge.
 */
export function buildDailyRun(pool: Company[], key = todayKey()): Round[] {
  const rand = seededRandom(key);
  const pairs = availableRounds(pool);
  const rounds: Round[] = [];
  const used = new Set<string>();
  while (rounds.length < 10) {
    const next = pickRound(pairs, rand, used, rounds.at(-1)?.metric);
    if (!next) break;
    rounds.push(next);
    used.add(roundKey(next));
  }
  return rounds;
}
