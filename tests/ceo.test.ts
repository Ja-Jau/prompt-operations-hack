import assert from "node:assert/strict";
import { test } from "node:test";
import { boardConfidence, buildCeoRun, CEO_ROUND_MS, CEO_ROUNDS, evaluateDecision, remainingTime } from "../src/lib/ceo/game";
import { CEO_SCENARIOS } from "../src/lib/ceo/scenarios";
import { seededRandom } from "../src/lib/game/random";

test("CEO runs contain unique scenarios and shuffled answer positions without changing the source", () => {
  const original = JSON.stringify(CEO_SCENARIOS);
  const random = seededRandom("ceo-runs");
  const positions = new Set<number>();
  const scenarios = new Set<string>();
  for (let play = 0; play < 20; play++) {
    const run = buildCeoRun(random);
    assert.equal(run.length, CEO_ROUNDS);
    assert.equal(new Set(run.map((scenario) => scenario.id)).size, CEO_ROUNDS);
    for (const scenario of run) {
      assert.equal(scenario.choices.length, 3);
      assert.equal(new Set(scenario.choices.map((choice) => choice.id)).size, 3);
      assert.equal(scenario.choices.filter((choice) => choice.correct).length, 1);
      positions.add(scenario.choices.findIndex((choice) => choice.correct));
      scenarios.add(scenario.id);
    }
  }
  assert.equal(positions.size, 3);
  assert.equal(scenarios.size, CEO_SCENARIOS.length);
  assert.equal(JSON.stringify(CEO_SCENARIOS), original);
});

test("CEO answers are accepted before the deadline and rejected at or after it", () => {
  const scenario = CEO_SCENARIOS[0];
  const correct = scenario.choices.find((choice) => choice.correct)!;
  const wrong = scenario.choices.find((choice) => !choice.correct)!;
  assert.equal(evaluateDecision(scenario, correct.id, 1).correct, true);
  assert.equal(evaluateDecision(scenario, wrong.id, 5000).correct, false);
  for (const remaining of [0, -1, -4000]) {
    const result = evaluateDecision(scenario, correct.id, remaining);
    assert.equal(result.timedOut, true);
    assert.equal(result.correct, false);
    assert.equal(result.choiceId, null);
  }
  assert.equal(evaluateDecision(scenario, null, 0).timedOut, true);
  assert.throws(() => evaluateDecision(scenario, "unknown", 5000));
});

test("CEO timer uses elapsed time even when browser callbacks are delayed", () => {
  const started = 100;
  const deadline = started + CEO_ROUND_MS;
  assert.equal(remainingTime(deadline, started), 20_000);
  assert.equal(remainingTime(deadline, started + 6_345), 13_655);
  assert.equal(remainingTime(deadline, started + 10_000), 10_000);
  assert.equal(remainingTime(deadline, started + 20_000), 0);
  assert.equal(remainingTime(deadline, started + 60_000), 0);
  assert.equal(remainingTime(deadline, started - 1000), CEO_ROUND_MS);
});

test("board confidence responds to correct calls, misses and timeouts within its limits", () => {
  const scenario = CEO_SCENARIOS[0];
  const right = evaluateDecision(scenario, scenario.choices.find((choice) => choice.correct)!.id, 1000);
  const wrong = evaluateDecision(scenario, scenario.choices.find((choice) => !choice.correct)!.id, 1000);
  const late = evaluateDecision(scenario, null, 0);
  assert.equal(boardConfidence([]), 50);
  assert.equal(boardConfidence([right, wrong, late]), 35);
  assert.equal(boardConfidence(Array(5).fill(right)), 100);
  assert.equal(boardConfidence(Array(5).fill(wrong)), 0);
  assert.equal(boardConfidence(Array(5).fill(late)), 0);
  assert.equal(boardConfidence([...Array(5).fill(late), right]), 10);
});
