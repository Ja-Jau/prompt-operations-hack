/** Baseline ("do nothing" run) and scoring. Pure, built on engine.ts. */
import { createGame, lostTotal, step, type Game, type Scenario } from "./engine";

/** The "do nothing" run on the same seed. Overflow is ignored so the full minute is measured. */
export function runBaseline(scn: Scenario, seed: number): Game {
  const g = createGame(scn, seed, { ignoreOverflow: true });
  while (!g.done) step(g);
  return g;
}

export type Score = {
  total: number; // 0..1000
  won: boolean;
  survived: boolean;
  savedSim: number; // simulated EUR saved vs doing nothing
  savedAnnual: number; // illustrative EUR per year
  costCutPct: number; // 0..100, simulated cost vs doing nothing
  clearedDelta: number; // extra orders cleared vs doing nothing
  timeToFind: number | null;
  agentsUsed: number;
  efficiency: number; // 0..1, share of agents placed where capacity was limiting
  parts: { money: number; cleared: number; speed: number; efficiency: number };
};

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** Compares a finished (or ended) game with its baseline at the same moment in time. */
export function scoreGame(g: Game, baseline: Game): Score {
  const survived = g.over === null;
  const sample = [...baseline.history].reverse().find((s) => s.t <= g.t + 1e-9);
  // Scored on money LOST (late orders, rework, idle capital): the number the HUD shows. Labour is left out on purpose,
  // because a fixed line processes more orders and would otherwise "pay more labour" than a stuck one.
  const baseCost = g.done ? lostTotal(baseline) : (sample?.lost ?? 0);
  const savedSim = Math.max(0, baseCost - lostTotal(g));
  const costCutPct = baseCost > 0 ? Math.round(clamp01(savedSim / baseCost) * 100) : 0;

  const ratio = g.arrived ? g.cleared / g.arrived : 0;
  const baseRatio = baseline.arrived ? baseline.cleared / baseline.arrived : 0;
  const clearedUplift = baseRatio < 1 ? clamp01((ratio - baseRatio) / (1 - baseRatio)) : 0;

  const speed = g.timeToFind === null ? 0 : clamp01(1 - g.timeToFind / 30);
  const useful = g.deploys.filter((d) => d.useful).length;
  const efficiency = g.deploys.length ? useful / g.deploys.length : 0;

  const parts = {
    money: Math.round(500 * clamp01(costCutPct / 100 / 0.8)),
    cleared: Math.round(200 * clearedUplift),
    speed: Math.round(150 * speed),
    efficiency: Math.round(150 * efficiency),
  };
  return {
    total: survived ? parts.money + parts.cleared + parts.speed + parts.efficiency : 0,
    survived,
    won: survived && g.done && costCutPct >= 25,
    savedSim,
    savedAnnual: Math.round(savedSim * g.scn.annualFactor),
    costCutPct,
    clearedDelta: g.cleared - baseline.cleared,
    timeToFind: g.timeToFind,
    agentsUsed: g.agents.filter((a) => a.everPlaced).length,
    efficiency,
    parts,
  };
}
