import type { Company } from "@/types/company";
import { comparable, METRIC_IDS, type MetricId } from "./metrics";

/** Independent pairs prevent sparse data from locking a run to one category. */
export type Round = { left: Company; right: Company; metric: MetricId };

export function roundKey(round: Round): string {
  return `${round.metric}:${[round.left.id, round.right.id].sort().join(":")}`;
}

export function availableRounds(pool: Company[]): Round[] {
  const sorted = [...pool].sort((a, b) => a.id.localeCompare(b.id));
  return METRIC_IDS.flatMap((metric) => sorted.flatMap((left, i) =>
    sorted.slice(i + 1).filter((right) => comparable(left, right, metric)).map((right) => ({ left, right, metric })),
  ));
}

/** Sample categories uniformly, then a pair. Larger datasets get no extra weight. */
export function pickRound(rounds: Round[], rand: () => number, recent: Set<string> = new Set(), previousMetric?: MetricId): Round | null {
  const eligible = rounds.filter((round) => !recent.has(roundKey(round)));
  if (!eligible.length) return null;
  const categories = METRIC_IDS.filter((metric) => eligible.some((round) => round.metric === metric));
  const different = categories.filter((metric) => metric !== previousMetric);
  const choices = different.length ? different : categories;
  const metric = choices[Math.floor(rand() * choices.length)];
  const pairs = eligible.filter((round) => round.metric === metric);
  const pair = pairs[Math.floor(rand() * pairs.length)];
  return rand() < 0.5 ? pair : { ...pair, left: pair.right, right: pair.left };
}

export function nextEndlessRound(rounds: Round[], history: Round[], rand: () => number): Round | null {
  const recent = new Set(history.slice(-5).map(roundKey));
  const previous = history.at(-1);
  return pickRound(rounds, rand, recent, previous?.metric)
    ?? pickRound(rounds, rand, new Set(previous ? [roundKey(previous)] : []), previous?.metric)
    ?? pickRound(rounds, rand);
}

/** A fresh five-question game; sparse datasets may reuse pairs. */
export function buildRandomRun(pairs: Round[], rand: () => number = Math.random): Round[] {
  const rounds: Round[] = [];
  while (rounds.length < 5) {
    const next = nextEndlessRound(pairs, rounds, rand);
    if (!next) break;
    rounds.push(next);
  }
  return rounds;
}
