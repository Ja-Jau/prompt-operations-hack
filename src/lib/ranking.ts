import type { Company } from "@/types/company";
import { revenuePerEmployee } from "./game/rules";

const WORK_HOURS_PER_WEEK = 37.5;

export type LadderPlacement = {
  /** 1 = highest revenue per employee. */
  rank: number;
  total: number;
  /** The company just above the player, if any. */
  above: Company | null;
  below: Company | null;
  /** Hours per person per week that would need freeing up to overtake `above`. */
  hoursToOvertake: number;
};

/**
 * Same output with fewer hours: matching a company that earns `gain` more per person
 * means freeing 1 - 1/(1+gain) of everyone's week.
 */
export function hoursToMatch(fromRpe: number, toRpe: number): number {
  const gain = toRpe / fromRpe - 1;
  return gain > 0 ? WORK_HOURS_PER_WEEK * (1 - 1 / (1 + gain)) : 0;
}

/** Where a company with `rpe` revenue per employee lands among the game's companies. */
export function placeOnLadder(companies: Company[], rpe: number, excludeId?: string): LadderPlacement {
  const ladder = companies
    .filter((c) => c.id !== excludeId)
    .sort((a, b) => revenuePerEmployee(b) - revenuePerEmployee(a));
  const index = ladder.findIndex((c) => revenuePerEmployee(c) < rpe);
  const position = index === -1 ? ladder.length : index;
  const above = position > 0 ? ladder[position - 1] : null;

  return {
    rank: position + 1,
    total: ladder.length + 1,
    above,
    below: ladder[position] ?? null,
    hoursToOvertake: above ? hoursToMatch(rpe, revenuePerEmployee(above)) : 0,
  };
}
