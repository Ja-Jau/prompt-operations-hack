/** generate(seed, difficulty): a candidate checked with the solver and regenerated until solvable (capped). */
import type { Scenario } from "./engine";
import { generateCandidate } from "./generator";
import { solve } from "./solver";

export { LEVELS, THEMES } from "./genCommon";

export type GenOptions = { stages?: number; maxTries?: number };

export function generate(seed: number, difficulty: number, opts: GenOptions = {}): Scenario {
  const d = Math.max(1, Math.min(5, Math.round(difficulty)));
  const maxTries = opts.maxTries ?? 40;
  let fallback: { scn: Scenario; gap: number } | null = null;
  for (let attempt = 0; attempt < maxTries; attempt++) {
    const scn = generateCandidate(seed, d, attempt, opts.stages);
    const sv = solve(scn, seed);
    const gap = sv.best.score.survived ? sv.best.score.total - sv.lazy.score.total : -1e9;
    scn.meta = {
      ...(scn.meta as NonNullable<Scenario["meta"]>), solvable: sv.ok, attempts: attempt + 1,
      solver: {
        best: sv.best.stages, bestScore: sv.best.score.total, bestCut: sv.best.score.costCutPct,
        lazy: sv.lazy.stages, lazyScore: sv.lazy.score.total,
      },
    };
    if (sv.ok) return scn;
    if (!fallback || gap > fallback.gap) fallback = { scn, gap };
  }
  return (fallback as { scn: Scenario }).scn;
}
