import type { Company } from "@/types/company";

/** Neighbouring cards must differ by at least this much, so no matchup is a coin flip. */
const MIN_GAP = 0.1;

/** Typical annual working hours for a full-time employee in Finland. */
const WORKING_HOURS_PER_YEAR = 1650;

export function revenuePerEmployee(c: Company): number {
  return (c.revenueEurM * 1_000_000) / c.employees;
}

/** Revenue per employee per working hour: what one hour of someone's time is worth to the company. */
export function revenuePerHour(c: Company): number {
  return revenuePerEmployee(c) / WORKING_HOURS_PER_YEAR;
}

function farEnough(a: Company, b: Company): boolean {
  const x = revenuePerEmployee(a);
  const y = revenuePerEmployee(b);
  return Math.abs(x - y) / Math.min(x, y) >= MIN_GAP;
}

/**
 * Picks the next card: a random company not in `recent` that is clearly
 * higher or lower than `last`. Returns null if none qualifies.
 */
export function pickNext(
  pool: Company[],
  last: Company,
  recent: Set<string>,
  rand: () => number,
): Company | null {
  const candidates = pool.filter((c) => !recent.has(c.id) && farEnough(c, last));
  if (candidates.length === 0) return null;
  return candidates[Math.floor(rand() * candidates.length)];
}
