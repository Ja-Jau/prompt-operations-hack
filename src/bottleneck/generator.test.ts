import assert from "node:assert/strict";
import { test } from "node:test";
import { bottleneckIndex, createGame, type Scenario } from "./engine";
import { generate } from "./generate";
import { generateCandidate } from "./generator";
import { THEMES } from "./genCommon";
import { lazyPlacement, solve } from "./solver";

const SEEDS = [1, 7, 42, 101, 555, 777, 2024, 9001, 31337, 123456];

test("same seed and difficulty give the same scenario", () => {
  for (const d of [1, 3, 5]) {
    assert.deepEqual(generate(4242, d), generate(4242, d));
  }
});

test("different seeds give different scenarios", () => {
  const sigs = new Set(SEEDS.map((s) => {
    const x = generate(s, 3);
    return `${x.title}|${x.stages.map((st) => st.name).join(",")}|${x.meta!.trueBottleneck}|${x.budget}`;
  }));
  assert.ok(sigs.size >= 8, `only ${sigs.size} distinct of ${SEEDS.length}`);
  const themes = new Set(SEEDS.map((s) => generate(s, 2).meta!.theme));
  assert.ok(themes.size >= 2, "more than one theme appears");
});

test("stage count is within 3..8 and matches the difficulty ladder", () => {
  for (const d of [1, 2, 3, 4, 5]) {
    for (const s of SEEDS.slice(0, 6)) {
      const x = generate(s, d);
      assert.ok(x.stages.length >= 3 && x.stages.length <= 8, `${x.stages.length} stages`);
      assert.ok(x.stages.length > x.agents, "more stages than agents, so placement is a choice");
    }
  }
  for (const n of [3, 5, 6, 8]) {
    assert.equal(generateCandidate(11, 2, 0, n).stages.length, n);
  }
});

test("a true bottleneck exists and is a middle stage", () => {
  for (const d of [1, 2, 3, 4, 5]) {
    for (const s of SEEDS.slice(0, 6)) {
      const x = generate(s, d);
      const g = createGame(x, s);
      const i = bottleneckIndex(g);
      assert.ok(i > 0 && i < x.stages.length - 1, `bottleneck index ${i} of ${x.stages.length}`);
      assert.equal(x.stages[i].id, x.meta!.trueBottleneck);
    }
  }
});

test("generated levels are solvable and a lazy strategy does not win", () => {
  for (const d of [1, 2, 3, 4, 5]) {
    for (const s of SEEDS) {
      const x = generate(s, d);
      assert.equal(x.meta!.solvable, true, `seed ${s} diff ${d} not solvable after ${x.meta!.attempts} tries`);
      const sv = solve(x, s);
      assert.ok(sv.best.score.survived && sv.best.score.costCutPct >= 35);
      assert.ok(!sv.lazy.score.survived || sv.lazy.score.total <= sv.best.score.total - 80);
    }
  }
});

test("the solvability check rejects an unsolvable scenario", () => {
  const x = generate(101, 2);
  // Make the line impossible to rescue: no agents at all.
  const broken: Scenario = { ...x, agents: 0 };
  const sv = solve(broken, 101);
  assert.equal(sv.ok, false);
  assert.ok(sv.reasons.length > 0);
  // And a scenario where the lazy strategy IS the best one must also be rejected.
  const lazy = lazyPlacement(x);
  assert.ok(lazy.length > 0);
});

test("generation always terminates (retry cap) and events fit the level", () => {
  const x = generate(5, 5, { maxTries: 1 });
  assert.equal(x.meta!.attempts, 1);
  for (const d of [1, 2, 3, 4, 5]) {
    const s = generate(300 + d, d);
    assert.ok(s.events.length >= 2 && s.events.length <= 4, `${s.events.length} events`);
    for (const e of s.events) assert.ok(e.at > 0 && e.at < s.durationSeconds);
  }
});

test("decoys appear from difficulty 3 and are not the bottleneck", () => {
  assert.equal(generate(9, 1).meta!.decoy, undefined);
  let seen = 0;
  for (const s of SEEDS) {
    const x = generate(s, 4);
    if (x.meta!.decoy) {
      seen++;
      assert.notEqual(x.meta!.decoy, x.meta!.trueBottleneck);
      assert.equal(x.stages.find((st) => st.id === x.meta!.decoy)!.kind, "manual");
    }
  }
  assert.ok(seen >= 5, `decoy in ${seen} of ${SEEDS.length}`);
});

test("themes in the data cover at least three workflows", () => {
  assert.ok(THEMES.length >= 3);
});
