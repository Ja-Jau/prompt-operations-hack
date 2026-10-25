/**
 * Procedural scenarios. generateCandidate(seed, difficulty, attempt) is deterministic; generate.ts wraps it with the
 * solvability check. Themes (themes.json) and events (events.json) are data, so new ones need no code change.
 */
import { nextRandom } from "./rng";
import type { Scenario, StageDef } from "./engine";
import { buildEvents } from "./genEvents";
import { LEVELS, THEMES, mix, r1, r2, rint, rnd, round5, shuffle, slug, type H, type Level, type Theme } from "./genCommon";

function pickStages(h: H, theme: Theme, n: number, L: Level) {
  const mids = shuffle(h, theme.stages.slice(1, -1).map((_, i) => i)).slice(0, n - 2).sort((a, b) => a - b);
  const picked = [theme.stages[0], ...mids.map((i) => theme.stages[i + 1]), theme.stages[theme.stages.length - 1]];
  const last = picked.length - 1;
  const midIdx = picked.map((_, i) => i).filter((i) => i > 0 && i < last);
  const manualMid = midIdx.filter((i) => picked[i].kind === "manual");
  // True bottleneck: a random middle stage, leaning late so "the first manual stage" is not the usual answer.
  const lateHalf = midIdx.slice(Math.floor(midIdx.length / 2));
  const pool = nextRandom(h) < 0.7 && lateHalf.length ? lateHalf : midIdx;
  const bn = pool[Math.floor(nextRandom(h) * pool.length)];
  // Decoy: the first manual-looking stage that is not the bottleneck. Looks slow, but keeps up.
  const decoy = L.decoy ? (manualMid.find((i) => i !== bn) ?? -1) : -1;
  return { picked, bn, decoy, midIdx };
}

export function generateCandidate(seed: number, difficulty: number, attempt: number, stageCount?: number): Scenario {
  const L = LEVELS[difficulty];
  const theme = THEMES[Math.floor(nextRandom(mix(seed, 0, 777)) * THEMES.length)]; // seed-only: retries keep the story
  const h = mix(seed, difficulty, attempt);
  const n = Math.max(3, Math.min(8, theme.stages.length, stageCount ?? rint(h, L.stages[0], L.stages[1])));
  const { picked, bn, decoy, midIdx } = pickStages(h, theme, n, L);

  const base = r1(rnd(h, 1.6, 2.2));
  const dur = L.seconds;
  const bnFactor = rnd(h, L.bn[0], L.bn[1]);
  const queueMax = Math.max(12, Math.min(40, Math.round(base * (1 - bnFactor) * dur * L.queueK)));

  const stages: StageDef[] = picked.map((p, i) => {
    const err = p.kind === "manual" ? rnd(h, 0.04, 0.09) : p.kind === "semi" ? rnd(h, 0.02, 0.05) : rnd(h, 0.005, 0.015);
    const factor = i === bn ? bnFactor : i === decoy ? rnd(h, 1.18, 1.3)
      : p.kind === "auto" ? rnd(h, 2.6, 4) : rnd(h, L.normal[0], L.normal[1]);
    const cap = base * factor;
    const need = (base * 1.12 * 1.35) / cap - 1; // boost that lifts this stage clear of peak demand
    const boost = i === bn ? need * rnd(h, 1.05, 1.3) : rnd(h, 1.0, 3.0);
    return {
      id: `${slug(p.name)}-${i}`, name: p.name, kind: p.kind,
      rate: r2(cap / (1 - err)), errorRate: r2(err),
      costPerItem: r1(p.kind === "manual" ? rnd(h, 3, 6) : p.kind === "semi" ? rnd(h, 2, 3.5) : rnd(h, 0.3, 1)),
      queueMax,
      deployCost: round5(p.kind === "manual" ? rnd(h, 28, 40) : p.kind === "semi" ? rnd(h, 22, 32) : rnd(h, 15, 22)),
      agentBoost: r2(boost),
      description: p.description,
    };
  });

  const mid = midIdx.map((i) => stages[i].deployCost);
  const avg = mid.reduce((a, b) => a + b, 0) / mid.length;
  const cheapestOther = Math.min(...midIdx.filter((i) => i !== bn).map((i) => stages[i].deployCost));
  const budget = Math.max(round5(avg * L.agents * L.budgetFactor), stages[bn].deployCost + cheapestOther);

  const events = buildEvents(h, theme, stages, midIdx, bn, difficulty, dur, L);
  const bnStage = stages[bn];
  const capBn = r1(bnStage.rate * (1 - bnStage.errorRate));
  const decoyText = decoy >= 0 ? ` "${stages[decoy].name}" looked just as manual but kept up, so fixing it would have changed little.` : "";
  const eventText = events.length ? ` Then ${events.slice(0, 2).map((e) => e.title.toLowerCase()).join(" and ")} moved the pressure, so agents had to move too.` : "";

  return {
    id: `gen-${theme.id}-${seed}-${difficulty}`,
    title: theme.title, industry: theme.industry, processName: theme.processName, intro: theme.intro,
    durationSeconds: dur,
    inflow: { base, rampTo: r2(base * 1.12) },
    slaSeconds: difficulty <= 2 ? 6 : 5, latePenalty: 1, holdingCost: 0.05, reworkMult: 2,
    budget, agents: L.agents, maxAgentsPerStage: L.perStage, redeploySeconds: 2.5,
    annualFactor: 30 + (seed % 11),
    stages, events,
    explain: {
      bottleneckId: bnStage.id,
      text: `${theme.unit} waited at "${bnStage.name}" because it handled about ${capBn} a second while ${base} arrived.${decoyText}${eventText}`,
    },
    meta: { seed, difficulty, theme: theme.id, trueBottleneck: bnStage.id, decoy: decoy >= 0 ? stages[decoy].id : undefined },
  };
}
