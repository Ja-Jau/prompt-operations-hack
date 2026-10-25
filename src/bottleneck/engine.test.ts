import assert from "node:assert/strict";
import { test } from "node:test";
import data from "./scenarios.json";
import {
  bottleneckIndex, capacity, costTotal, createGame, deploy, inflowRate, queueLen, step,
  type Game, type Scenario,
} from "./engine";
import { runBaseline, scoreGame } from "./score";

const scn = data.scenarios[0] as Scenario;
const idx = (id: string) => scn.stages.findIndex((s) => s.id === id);
const run = (g: Game, seconds: number) => {
  for (let i = 0; i < Math.round(seconds * 10); i++) step(g);
};

test("queue grows where inflow beats throughput, and only there", () => {
  const g = createGame(scn, 7, { ignoreOverflow: true });
  run(g, 12);
  assert.ok(queueLen(g, idx("pdf")) > 8, "manual stage should pile up");
  assert.ok(queueLen(g, idx("received")) <= 2, "fast first stage stays empty");
  assert.ok(queueLen(g, idx("invoice")) <= 2, "last stage stays empty");
});

test("bottleneck detection points at the manual stage, then follows the fix", () => {
  const g = createGame(scn, 7);
  assert.equal(g.scn.stages[bottleneckIndex(g)].id, "pdf");
  assert.ok(capacity(g, idx("pdf")) < inflowRate(g));

  assert.deepEqual(deploy(g, "pdf"), { ok: true });
  run(g, 3); // agent ramp finished
  // PDF now has capacity; ERP (2.7 * 0.97) is above 2.0 inflow at start, so nothing limits.
  assert.equal(bottleneckIndex(g), -1);
});

test("deploying an agent raises throughput, cuts errors and drains the queue", () => {
  const g = createGame(scn, 7, { ignoreOverflow: true });
  run(g, 10);
  const before = queueLen(g, idx("pdf"));
  const rateBefore = capacity(g, idx("pdf"));
  deploy(g, "pdf");
  run(g, 12);
  assert.ok(capacity(g, idx("pdf")) > rateBefore * 2.5);
  assert.ok(queueLen(g, idx("pdf")) < before / 2, `queue ${queueLen(g, idx("pdf"))} should shrink from ${before}`);
});

test("fixing a non-bottleneck barely helps", () => {
  const wrong = createGame(scn, 7, { ignoreOverflow: true });
  deploy(wrong, "erp");
  run(wrong, 30);
  const right = createGame(scn, 7, { ignoreOverflow: true });
  deploy(right, "pdf");
  run(right, 30);
  assert.ok(queueLen(wrong, idx("pdf")) > 20, "pile is still at the manual step");
  assert.ok(queueLen(right, idx("pdf")) < 5);
  assert.ok(costTotal(right) < costTotal(wrong) * 0.7);
});

test("budget and agent limits are enforced", () => {
  const g = createGame({ ...scn, agents: 3, budget: 100 }, 1);
  assert.deepEqual(deploy(g, "pdf"), { ok: true });
  assert.deepEqual(deploy(g, "pdf"), { ok: false, reason: "full" });
  assert.deepEqual(deploy(g, "nope"), { ok: false, reason: "unknown" });
  assert.deepEqual(deploy(g, "erp"), { ok: true });
  assert.deepEqual(deploy(g, "received"), { ok: true }); // 35 + 30 + 20 = 85 of 100 budget
  assert.equal(g.budget, 15);
  assert.deepEqual(deploy(g, "invoice"), { ok: false, reason: "no-agents" }); // all 3 agents used

  const poor = createGame({ ...scn, budget: 40 }, 1);
  assert.deepEqual(deploy(poor, "pdf"), { ok: true });
  assert.deepEqual(deploy(poor, "erp"), { ok: false, reason: "no-budget" });
});

test("overflow ends the game when nothing is done", () => {
  const g = createGame(scn, 3);
  run(g, 60);
  assert.equal(g.over, "overflow");
  assert.equal(g.scn.stages[g.overStage as number].id, "pdf");
});

test("same seed, same run; different seed differs", () => {
  const a = createGame(scn, 42, { ignoreOverflow: true });
  const b = createGame(scn, 42, { ignoreOverflow: true });
  const c = createGame(scn, 43, { ignoreOverflow: true });
  run(a, 30); run(b, 30); run(c, 30);
  assert.equal(a.cleared, b.cleared);
  assert.equal(costTotal(a), costTotal(b));
  assert.notEqual(costTotal(a), costTotal(c));
});

test("scoring: right fix beats wrong fix, and nothing scores zero when it overflows", () => {
  const baseline = runBaseline(scn, 11);
  assert.ok(baseline.done);

  const right = createGame(scn, 11);
  run(right, 8); deploy(right, "pdf"); run(right, 60);
  const sRight = scoreGame(right, baseline);
  assert.ok(right.done && sRight.survived);
  assert.ok(sRight.costCutPct >= 40, `cut ${sRight.costCutPct}`);
  assert.ok(sRight.timeToFind !== null && sRight.timeToFind < 10);
  assert.ok(sRight.savedAnnual > 0 && sRight.won);

  const wrong = createGame(scn, 11);
  deploy(wrong, "erp"); deploy(wrong, "invoice"); run(wrong, 60);
  const sWrong = scoreGame(wrong, baseline);
  assert.ok(sWrong.total < sRight.total / 2, `${sWrong.total} vs ${sRight.total}`);
  assert.equal(sWrong.timeToFind, null);

  const idle = createGame(scn, 11); run(idle, 60);
  assert.equal(scoreGame(idle, baseline).total, 0);
});

/* ---------- movable agents, skip, variable stages ---------- */
import { agentsAt, benchAgent, benchCount, placeAgent, skipToEnd, effectiveError, effectiveRate } from "./engine";

const many = (n: number, extra: Partial<Scenario> = {}): Scenario => {
  const base = scn.stages;
  const stages = Array.from({ length: n }, (_, i) => ({ ...base[i % base.length], id: `s${i}`, name: `Stage ${i}`, rate: i === 1 ? 1.2 : 6 }));
  return { ...scn, stages, explain: { ...scn.explain, bottleneckId: "s1" }, ...extra };
};

test("an agent can be moved, and the old stage loses the boost completely", () => {
  const g = createGame({ ...scn, agents: 2, budget: 200 }, 7, { ignoreOverflow: true });
  const base = effectiveRate(g, idx("pdf"));
  const baseErr = effectiveError(g, idx("pdf"));
  assert.deepEqual(placeAgent(g, 0, idx("pdf")), { ok: true });
  run(g, 4);
  assert.ok(effectiveRate(g, idx("pdf")) > base * 3);
  assert.deepEqual(placeAgent(g, 0, idx("erp")), { ok: true }); // move
  assert.equal(effectiveRate(g, idx("pdf")), base, "no leftover boost on the stage it left");
  assert.equal(effectiveError(g, idx("pdf")), baseErr);
  assert.equal(agentsAt(g, idx("pdf")).length, 0);
  assert.equal(g.moves, 1);
});

test("a moved agent is useless while re-deploying, then ramps in", () => {
  const g = createGame({ ...scn, agents: 1, budget: 200, redeploySeconds: 3 }, 7, { ignoreOverflow: true });
  placeAgent(g, 0, idx("erp"));
  run(g, 5);
  placeAgent(g, 0, idx("pdf"));
  const base = scn.stages[idx("pdf")].rate;
  run(g, 2);
  assert.equal(effectiveRate(g, idx("pdf")), base, "still redeploying after 2 s");
  run(g, 3);
  assert.ok(effectiveRate(g, idx("pdf")) > base * 2, "working after redeploy + ramp");
});

test("queue grows again after the agent leaves the bottleneck", () => {
  const g = createGame({ ...scn, agents: 1, budget: 200 }, 7, { ignoreOverflow: true });
  placeAgent(g, 0, idx("pdf"));
  run(g, 15);
  const drained = queueLen(g, idx("pdf"));
  assert.ok(drained < 6);
  benchAgent(g, 0);
  assert.equal(benchCount(g), 1);
  run(g, 15);
  assert.ok(queueLen(g, idx("pdf")) > drained + 8, "pile rebuilds");
});

test("money is paid once per stage; moving back is free; budget and bench are enforced", () => {
  const g = createGame({ ...scn, agents: 2, budget: 60 }, 1);
  placeAgent(g, 0, idx("pdf")); // 35
  assert.equal(g.budget, 25);
  placeAgent(g, 0, idx("erp")); // 30 > 25
  assert.equal(agentsAt(g, idx("erp")).length, 0);
  assert.deepEqual(placeAgent(g, 1, idx("erp")), { ok: false, reason: "no-budget" });
  benchAgent(g, 0);
  assert.deepEqual(placeAgent(g, 1, idx("pdf")), { ok: true }); // already integrated: free
  assert.equal(g.budget, 25);
  assert.deepEqual(placeAgent(g, 0, idx("pdf")), { ok: false, reason: "full" }); // maxAgentsPerStage 1
  assert.deepEqual(placeAgent(g, 1, idx("pdf")), { ok: false, reason: "same" });
});

test("a second agent on one stage helps, but less than the first", () => {
  const mk = (n: number) => {
    const g = createGame({ ...scn, agents: 2, budget: 200, maxAgentsPerStage: 2 }, 7, { ignoreOverflow: true });
    for (let k = 0; k < n; k++) placeAgent(g, k, idx("pdf"));
    run(g, 6);
    return effectiveRate(g, idx("pdf"));
  };
  const [r0, r1, r2] = [scn.stages[idx("pdf")].rate, mk(1), mk(2)];
  assert.ok(r1 > r0 && r2 > r1);
  assert.ok(r2 - r1 < r1 - r0, "diminishing returns");
});

test("skip-to-end gives exactly the same result as stepping in real time", () => {
  const play = (skipAt: number | null) => {
    const g = createGame({ ...scn, agents: 2, budget: 100 }, 99);
    run(g, 6); placeAgent(g, 0, idx("pdf"));
    run(g, 10); placeAgent(g, 1, idx("erp"));
    run(g, 5); placeAgent(g, 0, idx("erp")); // swap mid-run
    if (skipAt !== null) skipToEnd(g);
    else while (!g.done && !g.over) step(g);
    return g;
  };
  const watched = play(null), skipped = play(1);
  assert.equal(skipped.t, watched.t);
  assert.equal(skipped.cleared, watched.cleared);
  assert.equal(skipped.reworked, watched.reworked);
  assert.equal(costTotal(skipped), costTotal(watched));
  assert.deepEqual(skipped.stages.map((s) => s.queue), watched.stages.map((s) => s.queue));
  assert.equal(skipped.skippedAt !== null, true);
  const b = runBaseline(scn, 99);
  assert.equal(scoreGame(skipped, b).total, scoreGame(watched, b).total);
});

test("engine handles 3 to 8 stages", () => {
  for (const n of [3, 5, 6, 8]) {
    const s = many(n, { agents: 2, budget: 300 });
    const g = createGame(s, 5, { ignoreOverflow: true });
    assert.equal(g.stages.length, n);
    assert.equal(s.stages[bottleneckIndex(g)].id, "s1");
    run(g, 20);
    assert.ok(queueLen(g, 1) > 5);
    placeAgent(g, 0, 1);
    run(g, 30);
    assert.ok(g.cleared > 20 && g.t >= 49);
    assert.ok(skipToEnd(g).done);
  }
});

test("scenario duration is configurable", () => {
  const g = createGame({ ...scn, durationSeconds: 30 }, 3, { ignoreOverflow: true });
  skipToEnd(g);
  assert.ok(g.done && Math.abs(g.t - 30) < 0.11);
});
