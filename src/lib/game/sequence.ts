import type { Company } from "@/types/company";
import { METRICS, metricForRound, type MetricId } from "./metrics";

/** One card in a run: the company, and the metric it is compared on against the card before it. */
export type Step = { company: Company; metric: MetricId };

function pickNext(
  pool: Company[],
  last: Company,
  recent: Set<string>,
  rand: () => number,
  metricId: MetricId,
): Company | null {
  const metric = METRICS[metricId];
  const lastValue = metric.value(last);
  if (lastValue === null) return null;
  const candidates = pool.filter((c) => {
    const value = metric.value(c);
    return !recent.has(c.id) && value !== null && metric.farEnough(value, lastValue);
  });
  if (candidates.length === 0) return null;
  return candidates[Math.floor(rand() * candidates.length)];
}

/**
 * The card for guess number `round` (1-based). Velho rounds fall back to revenue per
 * employee when no company has comparable job-ad data.
 */
export function nextStep(
  pool: Company[],
  last: Company,
  round: number,
  recent: Set<string>,
  rand: () => number,
): Step | null {
  const preferred = metricForRound(round);
  const order: MetricId[] = preferred === "rpe" ? ["rpe"] : [preferred, "rpe"];
  for (const metric of order) {
    const company = pickNext(pool, last, recent, rand, metric);
    if (company) return { company, metric };
  }
  return null;
}

export function firstStep(pool: Company[], rand: () => number): Step {
  return { company: pool[Math.floor(rand() * pool.length)], metric: "rpe" };
}
