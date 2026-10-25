/**
 * Solver and solvability check. Uses the real engine, so "solvable" means "solvable in the game as played".
 * Search: every affordable static placement of the agents (one per stage), plus a dynamic "reader" that watches
 * queues and moves agents. A lazy strategy (agents on the first manual-looking stages) is the thing to beat.
 */
import { agentsAt, benchCount, createGame, placeAgent, queueLen, skipToEnd, step, type Game, type Scenario } from "./engine";
import { runBaseline, scoreGame, type Score } from "./score";

export type Eval = { name: string; stages: string[]; score: Score };
export type Solve = { best: Eval; lazy: Eval; ok: boolean; reasons: string[]; evaluated: number };

const MIN_CUT = 35; // best solution must cut simulated cost by at least this much
const MIN_GAP = 80; // and beat the lazy strategy by this many points (of 1000)

const ids = (scn: Scenario, idx: number[]) => idx.map((i) => scn.stages[i].id);

function evalStatic(scn: Scenario, seed: number, stages: number[], base: Game): Score {
  const g = createGame(scn, seed);
  stages.forEach((s, k) => placeAgent(g, k, s));
  skipToEnd(g);
  return scoreGame(g, base);
}

/** Dynamic strategy: from `delay` s, every `every` s put a bench agent on the hottest bare stage, or move an idle one. */
export function readerRun(scn: Scenario, seed: number, base: Game, delay = 2, every = 3): { score: Score; g: Game } {
  const g = createGame(scn, seed);
  let last = -99;
  while (!g.done && !g.over) {
    if (g.t >= delay && g.t - last >= every) {
      let hot = -1, hotQ = 6;
      scn.stages.forEach((_, i) => {
        if (agentsAt(g, i).length === 0 && queueLen(g, i) > hotQ) { hotQ = queueLen(g, i); hot = i; }
      });
      if (hot >= 0) {
        let agent = g.agents.find((a) => a.at === null);
        if (!agent) agent = g.agents.find((a) => a.at !== null && queueLen(g, a.at) <= 1 && g.t >= a.readyAt);
        if (agent && placeAgent(g, agent.id, hot).ok) last = g.t;
      }
    }
    step(g);
  }
  return { score: scoreGame(g, base), g };
}

function combos(n: number, k: number): number[][] {
  const out: number[][] = [];
  const rec = (start: number, cur: number[]) => {
    if (cur.length === k) { out.push([...cur]); return; }
    for (let i = start; i < n; i++) { cur.push(i); rec(i + 1, cur); cur.pop(); }
  };
  rec(0, []);
  return out;
}

export function lazyPlacement(scn: Scenario): number[] {
  const order = scn.stages.map((s, i) => ({ s, i }));
  const manual = order.filter((o) => o.s.kind === "manual");
  const rest = order.filter((o) => o.s.kind !== "manual");
  return [...manual, ...rest].slice(0, scn.agents).map((o) => o.i);
}

export function solve(scn: Scenario, seed: number): Solve {
  const base = runBaseline(scn, seed);
  const n = scn.stages.length;
  const k = Math.min(scn.agents, n);
  const cost = (c: number[]) => c.reduce((s, i) => s + scn.stages[i].deployCost, 0);

  let pool = combos(n, k).filter((c) => cost(c) <= scn.budget);
  for (let size = k - 1; !pool.length && size >= 1; size--) pool = combos(n, size).filter((c) => cost(c) <= scn.budget);

  let best: Eval = { name: "none", stages: [], score: evalStatic(scn, seed, [], base) };
  let evaluated = 0;
  for (const c of pool) {
    const score = evalStatic(scn, seed, c, base);
    evaluated++;
    if (score.total > best.score.total) best = { name: "static", stages: ids(scn, c), score };
  }
  const dyn = readerRun(scn, seed, base);
  evaluated++;
  if (dyn.score.total > best.score.total) {
    best = { name: "dynamic reader", stages: dyn.g.deploys.map((d) => `${d.stage}@${Math.round(d.t)}s`), score: dyn.score };
  }

  const lz = lazyPlacement(scn);
  const lazy: Eval = { name: "lazy (first manual stages)", stages: ids(scn, lz), score: evalStatic(scn, seed, lz, base) };

  const reasons: string[] = [];
  if (!best.score.survived) reasons.push("best placement does not survive");
  if (best.score.costCutPct < MIN_CUT) reasons.push(`best cut ${best.score.costCutPct}% < ${MIN_CUT}%`);
  if (lazy.score.survived && lazy.score.total > best.score.total - MIN_GAP) {
    reasons.push(`lazy ${lazy.score.total} too close to best ${best.score.total}`);
  }
  return { best, lazy, ok: reasons.length === 0, reasons, evaluated };
}

export { benchCount };
