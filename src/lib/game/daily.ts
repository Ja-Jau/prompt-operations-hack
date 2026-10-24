import type { Company } from "@/types/company";
import { seededRandom } from "./random";
import { pickNext } from "./rules";

export const DAILY_ROUNDS = 10;
const LAUNCH_DATE = "2026-10-24";

export function todayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/** Puzzle number shown in the share text: #1 on launch day. */
export function dailyNumber(key = todayKey()): number {
  const days = (Date.parse(key) - Date.parse(LAUNCH_DATE)) / 86_400_000;
  return Math.max(1, Math.floor(days) + 1);
}

/** The same sequence of DAILY_ROUNDS + 1 companies for every player on a given day. */
export function buildDailyRun(pool: Company[], key = todayKey()): Company[] {
  const rand = seededRandom(key);
  const first = pool[Math.floor(rand() * pool.length)];
  const run = [first];
  const used = new Set([first.id]);
  while (run.length < DAILY_ROUNDS + 1) {
    const next = pickNext(pool, run[run.length - 1], used, rand);
    if (!next) break;
    run.push(next);
    used.add(next.id);
  }
  return run;
}
