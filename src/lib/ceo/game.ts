import { CEO_SCENARIOS, type CeoScenario } from "./scenarios";

export const CEO_ROUND_MS = 20_000;
export const CEO_ROUNDS = 5;

export function shuffled<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Fresh scenarios and answer positions on each run; the right answer has no fixed slot. */
export function buildCeoRun(random: () => number = Math.random): CeoScenario[] {
  return shuffled(CEO_SCENARIOS, random).slice(0, CEO_ROUNDS).map((scenario) => ({
    ...scenario,
    choices: shuffled(scenario.choices, random) as CeoScenario["choices"],
  }));
}

export type CeoDecision = {
  scenarioId: string;
  choiceId: string | null;
  correct: boolean;
  timedOut: boolean;
};

export function remainingTime(deadline: number, now: number): number {
  return Math.max(0, Math.min(CEO_ROUND_MS, deadline - now));
}

/** The actual deadline wins even if a browser throttles its timer callbacks. */
export function evaluateDecision(scenario: CeoScenario, choiceId: string | null, remainingMs: number): CeoDecision {
  const timedOut = remainingMs <= 0 || choiceId === null;
  const choice = timedOut ? null : scenario.choices.find((option) => option.id === choiceId);
  if (!timedOut && !choice) throw new Error("Unknown CEO choice");
  return { scenarioId: scenario.id, choiceId: timedOut ? null : choiceId,
    correct: choice?.correct ?? false, timedOut };
}

/** A fictional game meter: correct decisions build trust; misses and delays reduce it. */
export function boardConfidence(decisions: readonly CeoDecision[]): number {
  return decisions.reduce((confidence, decision) =>
    Math.max(0, Math.min(100, confidence + (decision.correct ? 10 : decision.timedOut ? -15 : -10))), 50);
}
