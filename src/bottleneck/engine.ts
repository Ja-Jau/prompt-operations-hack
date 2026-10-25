/**
 * Fix the Bottleneck: pure simulation engine. No DOM, no timers, no network.
 * The UI owns the clock and calls step() with a fixed dt (0.1 s); everything here is deterministic
 * for a given scenario + seed, so runs can be replayed and tested.
 */
import { nextRandom } from "./rng";

export type Kind = "manual" | "semi" | "auto";

export type StageDef = {
  id: string;
  name: string;
  kind: Kind;
  rate: number; // items per second at full capacity
  errorRate: number; // share of items that need rework
  costPerItem: number; // labour cost per processed item
  queueMax: number; // overflow here ends the game
  deployCost: number;
  agentBoost: number; // rate multiplier added by an agent: rate * (1 + boost)
  description: string;
};

export type EffectDef =
  | { type: "inflowMult"; value: number; duration: number }
  | { type: "stageRateMult"; stage: string; value: number; duration: number; onlyManual?: boolean }
  | { type: "stageErrorAdd"; stage: string; value: number; duration: number };

export type EventDef = { id: string; at: number; title: string; text: string; effects: EffectDef[] };

export type Scenario = {
  id: string;
  title: string;
  industry: string;
  processName: string; // used in headlines: "order-processing cost"
  intro: string;
  durationSeconds: number;
  inflow: { base: number; rampTo: number };
  slaSeconds: number; // an order older than this counts as late
  latePenalty: number; // EUR per late order per second
  holdingCost: number; // EUR per order in the system per second (idle capital)
  reworkMult: number; // rework costs this many times costPerItem
  budget: number;
  agents: number;
  maxAgentsPerStage?: number; // default 1; 2 allows a second agent with diminishing returns
  redeploySeconds?: number; // default 2.5: a moved agent gives no benefit for this long
  meta?: {
    seed: number;
    difficulty: number;
    theme: string;
    trueBottleneck: string;
    decoy?: string;
    solvable?: boolean;
    attempts?: number;
    solver?: { best: string[]; bestScore: number; bestCut: number; lazy: string[]; lazyScore: number };
  };
  annualFactor: number; // simulated EUR -> illustrative EUR per year
  stages: StageDef[];
  events: EventDef[];
  explain: { bottleneckId: string; text: string };
};

type ActiveEffect = EffectDef & { until: number };
type StageState = { queue: number[]; credit: number; integrated: boolean };

/** at === null means the agent is on the bench. */
export type Agent = { id: number; at: number | null; readyAt: number; everPlaced: boolean };
export type Deploy = { agent: number; stage: string; t: number; move: boolean; wasBottleneck: boolean; useful: boolean };
export type Sample = { t: number; wip: number; cost: number; lost: number; queues: number[] };
export type LogEntry = { id: string; at: number; title: string; text: string };

export type Game = {
  scn: Scenario;
  seed: number;
  rng: number;
  t: number;
  tick: number;
  stages: StageState[];
  arrivalCredit: number;
  active: ActiveEffect[];
  fired: string[];
  log: LogEntry[];
  arrived: number;
  cleared: number;
  reworked: number;
  cost: { late: number; rework: number; holding: number; labor: number };
  lossWindow: number[];
  budget: number;
  agents: Agent[];
  moves: number;
  skippedAt: number | null;
  deploys: Deploy[];
  timeToFind: number | null;
  over: "overflow" | null;
  overStage: number | null;
  done: boolean;
  ignoreOverflow: boolean;
  history: Sample[];
};

export const DT = 0.1;
export const AGENT_RAMP_SEC = 2;
const AGENT_ERROR_MULT = 0.25;
const AGENT_LABOR_MULT = 0.2;

export function createGame(scn: Scenario, seed = 1, opts: { ignoreOverflow?: boolean } = {}): Game {
  return {
    scn, seed, rng: seed | 0, t: 0, tick: 0,
    stages: scn.stages.map(() => ({ queue: [], credit: 0, integrated: false })),
    arrivalCredit: 0, active: [], fired: [], log: [],
    arrived: 0, cleared: 0, reworked: 0,
    cost: { late: 0, rework: 0, holding: 0, labor: 0 },
    lossWindow: [],
    budget: scn.budget,
    agents: Array.from({ length: scn.agents }, (_, id) => ({ id, at: null, readyAt: 0, everPlaced: false })),
    moves: 0, skippedAt: null,
    deploys: [], timeToFind: null,
    over: null, overStage: null, done: false,
    ignoreOverflow: !!opts.ignoreOverflow,
    history: [],
  };
}

/* ---------- derived values ---------- */

export function inflowRate(g: Game, t = g.t): number {
  const { base, rampTo } = g.scn.inflow;
  let r = base + (rampTo - base) * Math.min(1, t / g.scn.durationSeconds);
  for (const e of g.active) if (e.type === "inflowMult" && t < e.until) r *= e.value;
  return r;
}

export const maxPerStage = (scn: Scenario) => scn.maxAgentsPerStage ?? 1;
export const redeploySeconds = (scn: Scenario) => scn.redeploySeconds ?? 2.5;
export const agentsAt = (g: Game, i: number) => g.agents.filter((a) => a.at === i);
export const benchCount = (g: Game) => g.agents.filter((a) => a.at === null).length;

/**
 * Agent strength on a stage, always derived from where agents stand right now (nothing is stored on the stage,
 * so a moved agent leaves no boost behind). Each agent ramps in over AGENT_RAMP_SEC after it is ready;
 * the 2nd agent counts half, the 3rd a quarter.
 */
export function agentWeight(g: Game, i: number): number {
  return agentsAt(g, i)
    .map((a) => Math.max(0, Math.min(1, (g.t - a.readyAt) / AGENT_RAMP_SEC)))
    .sort((a, b) => b - a)
    .reduce((sum, ramp, k) => sum + ramp * Math.pow(0.5, k), 0);
}

export function stageKind(g: Game, i: number): Kind {
  return g.agents.some((a) => a.at === i && g.t >= a.readyAt) ? "auto" : g.scn.stages[i].kind;
}

export function effectiveRate(g: Game, i: number): number {
  const def = g.scn.stages[i];
  let rate = def.rate * (1 + def.agentBoost * agentWeight(g, i));
  for (const e of g.active) {
    if (e.type !== "stageRateMult" || e.stage !== def.id || g.t >= e.until) continue;
    if (e.onlyManual && stageKind(g, i) !== "manual") continue;
    rate *= e.value;
  }
  return rate;
}

export function effectiveError(g: Game, i: number): number {
  const def = g.scn.stages[i];
  let err = def.errorRate;
  for (const e of g.active) if (e.type === "stageErrorAdd" && e.stage === def.id && g.t < e.until) err += e.value;
  err *= 1 - (1 - AGENT_ERROR_MULT) * Math.min(1, agentWeight(g, i));
  return Math.min(0.9, Math.max(0, err));
}

/** Good items per second the stage can really pass on (rework eats capacity). */
export function capacity(g: Game, i: number): number {
  return effectiveRate(g, i) * (1 - effectiveError(g, i));
}

/** Index of the stage that limits the flow, or -1 if every stage keeps up with demand. */
export function bottleneckIndex(g: Game): number {
  const demand = inflowRate(g);
  let worst = -1;
  let worstCap = Infinity;
  g.stages.forEach((_, i) => {
    const c = capacity(g, i);
    if (c < demand && c < worstCap) {
      worstCap = c;
      worst = i;
    }
  });
  return worst;
}

export const queueLen = (g: Game, i: number) => g.stages[i].queue.length;
export const isHot = (g: Game, i: number) => g.stages[i].queue.length > g.scn.stages[i].queueMax * 0.4;
export const wip = (g: Game) => g.stages.reduce((n, s) => n + s.queue.length, 0);
export const lostTotal = (g: Game) => g.cost.late + g.cost.rework + g.cost.holding;
export const costTotal = (g: Game) => lostTotal(g) + g.cost.labor;

/** Money lost per minute, averaged over the last 3 seconds. */
export function lossPerMin(g: Game): number {
  if (!g.lossWindow.length) return 0;
  const sum = g.lossWindow.reduce((a, b) => a + b, 0);
  return (sum / (g.lossWindow.length * DT)) * 60;
}

/* ---------- actions ---------- */

export type ActionResult =
  | { ok: true }
  | { ok: false; reason: "over" | "no-agents" | "no-budget" | "full" | "same" | "unknown" };
export type DeployResult = ActionResult;

/**
 * Put a bench agent on a stage, or move an agent from one stage to another.
 * Money: a stage is paid for once (its deployCost) the first time any agent stands on it; moving back is free.
 * Time: an agent that has been placed before re-deploys for redeploySeconds and gives no benefit meanwhile.
 */
export function placeAgent(g: Game, agentId: number, stageIndex: number): ActionResult {
  const agent = g.agents.find((a) => a.id === agentId);
  const def = g.scn.stages[stageIndex];
  if (!agent || !def) return { ok: false, reason: "unknown" };
  if (g.over || g.done) return { ok: false, reason: "over" };
  if (agent.at === stageIndex) return { ok: false, reason: "same" };
  if (agentsAt(g, stageIndex).length >= maxPerStage(g.scn)) return { ok: false, reason: "full" };
  const st = g.stages[stageIndex];
  if (!st.integrated && g.budget < def.deployCost) return { ok: false, reason: "no-budget" };

  const wasBottleneck = bottleneckIndex(g) === stageIndex;
  const useful = capacity(g, stageIndex) < inflowRate(g) * 1.15;
  if (!st.integrated) {
    g.budget -= def.deployCost;
    st.integrated = true;
  }
  const move = agent.everPlaced;
  agent.at = stageIndex;
  agent.readyAt = g.t + (move ? redeploySeconds(g.scn) : 0);
  agent.everPlaced = true;
  if (move) g.moves += 1;
  g.deploys.push({ agent: agentId, stage: def.id, t: g.t, move, wasBottleneck, useful });
  if (wasBottleneck && g.timeToFind === null) g.timeToFind = g.t;
  return { ok: true };
}

/** Take an agent off its stage and back to the bench. Free; its stage loses the boost at once. */
export function benchAgent(g: Game, agentId: number): ActionResult {
  const agent = g.agents.find((a) => a.id === agentId);
  if (!agent) return { ok: false, reason: "unknown" };
  if (g.over || g.done) return { ok: false, reason: "over" };
  if (agent.at === null) return { ok: false, reason: "same" };
  agent.at = null;
  agent.readyAt = g.t;
  return { ok: true };
}

/** Convenience: place the first bench agent on a stage (by id). */
export function deploy(g: Game, stageId: string): ActionResult {
  const i = g.scn.stages.findIndex((s) => s.id === stageId);
  if (i < 0) return { ok: false, reason: "unknown" };
  if (g.over || g.done) return { ok: false, reason: "over" };
  if (agentsAt(g, i).length >= maxPerStage(g.scn)) return { ok: false, reason: "full" };
  const free = g.agents.find((a) => a.at === null);
  if (!free) return { ok: false, reason: "no-agents" };
  return placeAgent(g, free.id, i);
}

/* ---------- the tick ---------- */

export function step(g: Game, dt = DT): void {
  if (g.over || g.done) return;
  const { scn } = g;
  g.t += dt;
  g.tick += 1;

  // Events fire once, when their time is reached.
  for (const ev of scn.events) {
    if (g.t >= ev.at && !g.fired.includes(ev.id)) {
      g.fired.push(ev.id);
      g.log.push({ id: ev.id, at: g.t, title: ev.title, text: ev.text });
      for (const eff of ev.effects) g.active.push({ ...eff, until: g.t + eff.duration });
    }
  }
  g.active = g.active.filter((e) => g.t < e.until);

  // New work arrives at stage 0.
  g.arrivalCredit += inflowRate(g) * dt;
  while (g.arrivalCredit >= 1) {
    g.arrivalCredit -= 1;
    g.stages[0].queue.push(g.t);
    g.arrived += 1;
  }

  // Process stages last-to-first so an order moves at most one stage per tick.
  for (let i = scn.stages.length - 1; i >= 0; i--) {
    const def = scn.stages[i];
    const st = g.stages[i];
    st.credit += effectiveRate(g, i) * dt;
    const err = effectiveError(g, i);
    const labor = def.costPerItem * (1 - (1 - AGENT_LABOR_MULT) * Math.min(1, agentWeight(g, i)));
    while (st.credit >= 1 && st.queue.length) {
      st.credit -= 1;
      const entered = st.queue.shift() as number;
      g.cost.labor += labor;
      if (nextRandom(g) < err) {
        g.reworked += 1;
        g.cost.rework += labor * scn.reworkMult;
        st.queue.push(entered); // back of the line, still ageing
      } else if (i === scn.stages.length - 1) {
        g.cleared += 1;
      } else {
        g.stages[i + 1].queue.push(entered);
      }
    }
    if (!st.queue.length) st.credit = Math.min(st.credit, 1); // idle capacity can't be banked
  }

  // Money lost this tick: late orders and idle capital.
  let late = 0;
  let inSystem = 0;
  for (const st of g.stages) {
    for (const entered of st.queue) {
      inSystem += 1;
      if (g.t - entered > scn.slaSeconds) late += 1;
    }
  }
  const lateCost = late * scn.latePenalty * dt;
  const holdCost = inSystem * scn.holdingCost * dt;
  g.cost.late += lateCost;
  g.cost.holding += holdCost;
  g.lossWindow.push(lateCost + holdCost);
  if (g.lossWindow.length > 30) g.lossWindow.shift();

  if (g.tick % 5 === 0) {
    g.history.push({ t: g.t, wip: inSystem, cost: costTotal(g), lost: lostTotal(g), queues: g.stages.map((s) => s.queue.length) });
  }

  if (!g.ignoreOverflow) {
    for (let i = 0; i < g.stages.length; i++) {
      if (g.stages[i].queue.length > scn.stages[i].queueMax) {
        g.over = "overflow";
        g.overStage = i;
        return;
      }
    }
  }
  if (g.t >= scn.durationSeconds - 1e-9) g.done = true;
}

/**
 * Fast-forward to the end with the CURRENT agent placement: the same step() the live loop uses, just without
 * rendering, so a skipped run and a watched run give identical results.
 */
export function skipToEnd(g: Game): Game {
  if (!g.done && g.over === null) g.skippedAt = g.t;
  while (!g.done && !g.over) step(g);
  return g;
}
