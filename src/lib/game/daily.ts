import type { Company } from "@/types/company";
import { seededRandom } from "./random";
import { firstStep, nextStep, type Step } from "./sequence";

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
 * Today's run: the same chain of companies for every player, each used once, as long as
 * the pool allows. Players go until their first wrong guess, so scores are comparable.
 */
export function buildDailyRun(pool: Company[], key = todayKey()): Step[] {
  const rand = seededRandom(key);
  const steps = [firstStep(pool, rand)];
  const used = new Set([steps[0].company.id]);
  for (;;) {
    const next = nextStep(pool, steps[steps.length - 1].company, steps.length, used, rand);
    if (!next) break;
    steps.push(next);
    used.add(next.company.id);
  }
  return steps;
}
