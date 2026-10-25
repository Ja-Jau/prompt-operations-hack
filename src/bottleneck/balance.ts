/**
 * Balance probe over GENERATED levels. For each difficulty, N seeds, several strategies:
 *   solver  - the best placement found by solve() (an upper bound on skill)
 *   reader  - watches queues, acts after `delay` s and moves idle agents (a sensible first-time player)
 *   slow    - the same, but starts late
 *   lazy    - all agents on the first manual-looking stages at t=0
 *   random  - drops agents on random stages
 * "win" = survived and cost cut >= 25%. Run:
 *   npx tsc -p src/bottleneck/tsconfig.test.json && node /tmp/bottleneck-tests/src/bottleneck/balance.js [N]
 */
import { createGame, placeAgent, skipToEnd, step, type Game, type Scenario } from "./engine";
import { generate } from "./generate";
import { nextRandom } from "./rng";
import { runBaseline, scoreGame, type Score } from "./score";
import { lazyPlacement, readerRun } from "./solver";

type Result = { score: Score; g: Game };

function lazy(scn: Scenario, seed: number, base: Game): Result {
  const g = createGame(scn, seed);
  lazyPlacement(scn).forEach((s, k) => placeAgent(g, k, s));
  skipToEnd(g);
  return { score: scoreGame(g, base), g };
}

function random(scn: Scenario, seed: number, base: Game): Result {
  const g = createGame(scn, seed);
  const r = { rng: seed * 31 + 7 };
  while (!g.done && !g.over) {
    if (g.t > 3 && nextRandom(r) < 0.03) {
      const agent = g.agents[Math.floor(nextRandom(r) * g.agents.length)];
      placeAgent(g, agent.id, Math.floor(nextRandom(r) * scn.stages.length));
    }
    step(g);
  }
  return { score: scoreGame(g, base), g };
}

function solverRun(scn: Scenario, seed: number, base: Game): Result {
  const m = scn.meta!.solver!;
  return { score: { total: m.bestScore, costCutPct: m.bestCut, survived: true, won: m.bestCut >= 25 } as Score, g: base };
}

const STRATS: Record<string, (s: Scenario, seed: number, b: Game) => Result> = {
  solver: solverRun,
  "reader (acts at 2s)": (s, seed, b) => readerRun(s, seed, b, 2, 3),
  "reader (acts at 6s)": (s, seed, b) => readerRun(s, seed, b, 6, 4),
  "slow reader (11s)": (s, seed, b) => readerRun(s, seed, b, 11, 6),
  lazy,
  random,
};

if (require.main === module) {
  const N = Number(process.argv[2] ?? 40);
  for (const d of [1, 2, 3, 4, 5]) {
    const rows: Record<string, { win: number; surv: number; score: number }> = {};
    let solvable = 0, tries = 0;
    for (let k = 0; k < N; k++) {
      const seed = 1000 + k * 37 + d;
      const scn = generate(seed, d);
      const base = runBaseline(scn, seed);
      solvable += scn.meta!.solvable ? 1 : 0;
      tries += scn.meta!.attempts!;
      for (const [name, fn] of Object.entries(STRATS)) {
        const { score } = fn(scn, seed, base);
        const r = (rows[name] ??= { win: 0, surv: 0, score: 0 });
        r.win += score.won ? 1 : 0;
        r.surv += score.survived ? 1 : 0;
        r.score += score.total;
      }
    }
    console.log(`\nDifficulty ${d}  (${N} generated levels, ${solvable} verified solvable, avg ${(tries / N).toFixed(1)} generator tries)`);
    for (const [name, r] of Object.entries(rows)) {
      console.log(`  ${name.padEnd(20)} win ${String(Math.round((r.win / N) * 100)).padStart(3)}%  survive ${String(Math.round((r.surv / N) * 100)).padStart(3)}%  avg score ${String(Math.round(r.score / N)).padStart(4)}`);
    }
  }
}
