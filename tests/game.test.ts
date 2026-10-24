import assert from "node:assert/strict";
import { test } from "node:test";
import type { Company, EfficiencyMetricId, EfficiencyObservation } from "../src/types/company";
import { comparable, METRIC_IDS, METRICS } from "../src/lib/game/metrics";
import { availableRounds, buildRandomRun, nextEndlessRound, pickRound, roundKey } from "../src/lib/game/sequence";
import { buildDailyRun } from "../src/lib/game/daily";
import { shareText } from "../src/lib/game/share";
import { seededRandom } from "../src/lib/game/random";
import companies from "../src/data/companies.json";
import gameCompanies from "../src/data/game_companies.json";
import efficiency from "../src/data/efficiency.json";

function company(id: string, value: number, ids: EfficiencyMetricId[] = [...METRIC_IDS]): Company {
  return {
    ...companies[0], id,
    efficiency: Object.fromEntries(ids.map((metric) => [metric, {
      value, year: 2025, period: "FY 2025", scope: "consolidated", definition: metric,
      fetchedAt: "2026-10-24", sources: [{ url: "https://example.com/report", label: "Report", evidence: "Facts" }],
      inputs: {}, note: "Test observation",
    }])),
  } as Company;
}

test("only comparable sourced data becomes a question", () => {
  const a = company("a", 10), b = company("b", 30);
  assert.equal(availableRounds([a, b]).length, 4);
  assert.equal(availableRounds([a, { ...b, efficiency: {} }]).length, 0);
  assert.equal(availableRounds([a, company("b", 10)]).length, 0);
  const differentYear = company("b", 30);
  for (const value of Object.values(differentYear.efficiency!)) value.year = 2024;
  assert.equal(availableRounds([a, differentYear]).length, 0);
  differentYear.efficiency!.growthGap!.year = 2025;
  differentYear.efficiency!.growthGap!.definition = "closingHeadcount";
  assert.equal(comparable(a, differentYear, "growthGap"), false);
});

test("categories are sampled evenly despite unequal company coverage", () => {
  const pool = [company("a", 1), company("b", 40), ...Array.from({ length: 20 }, (_, i) => company(`extra${i}`, i * 10, ["growthGap"]))];
  const pairs = availableRounds(pool), rand = seededRandom("distribution");
  const counts = Object.fromEntries(METRIC_IDS.map((id) => [id, 0]));
  for (let i = 0; i < 12000; i++) counts[pickRound(pairs, rand)!.metric]++;
  for (const count of Object.values(counts)) assert.ok(count > 2700 && count < 3300, String(count));
});

test("daily questions are repeatable, skip repeated pairs and change categories", () => {
  const pool = [company("a", 1), company("b", 40), company("c", 70)];
  const run = buildDailyRun(pool, "2026-10-24");
  assert.equal(run.length, 10);
  assert.deepEqual(run, buildDailyRun([...pool].reverse(), "2026-10-24"));
  assert.equal(new Set(run.map(roundKey)).size, run.length);
  for (let i = 1; i < run.length; i++) assert.notEqual(run[i].metric, run[i - 1].metric);
  assert.notDeepEqual(run, buildDailyRun(pool, "2026-10-25"));
});

test("endless remains playable with just one eligible pair", () => {
  const pairs = availableRounds([company("a", 1, ["manualAds"]), company("b", 40, ["manualAds"])]);
  const history = [];
  const rand = seededRandom("endless");
  for (let i = 0; i < 20; i++) {
    const next = nextEndlessRound(pairs, history, rand);
    assert.ok(next);
    history.push(next);
  }
  assert.equal(nextEndlessRound([], [], rand), null);
  assert.deepEqual(buildDailyRun([]), []);
});

test("committed real data supplies every category without placeholder fallbacks", () => {
  const data = efficiency as Record<string, { metrics: Partial<Record<EfficiencyMetricId, EfficiencyObservation>> }>;
  const pool = gameCompanies.map((c) => ({ ...c, efficiency: data[c.id]?.metrics ?? {} }));
  const pairs = availableRounds(pool);
  for (const id of METRIC_IDS) {
    assert.ok(pairs.some((r) => r.metric === id), `No playable pair for ${id}`);
  }
  for (const pair of pairs) {
    const metric = METRICS[pair.metric];
    assert.notEqual(metric.format(metric.value(pair.left)!), metric.format(metric.value(pair.right)!));
  }
});

test("five-round games get fresh random categories on each play", () => {
  const pairs = availableRounds([company("a", 1), company("b", 40), company("c", 70)]);
  const random = seededRandom("new-playthroughs");
  const first = buildRandomRun(pairs, random);
  const second = buildRandomRun(pairs, random);
  assert.equal(first.length, 5);
  assert.equal(second.length, 5);
  assert.notDeepEqual(first.map((r) => r.metric), second.map((r) => r.metric));
  for (const run of [first, second]) {
    for (let i = 1; i < run.length; i++) assert.notEqual(run[i].metric, run[i - 1].metric);
  }
  assert.equal(buildRandomRun(pairs.slice(0, 1), random).length, 5);
  assert.deepEqual(buildRandomRun([], random), []);
});

test("endless continues beyond five rounds and shares the actual total", () => {
  const pairs = availableRounds([company("a", 1), company("b", 40), company("c", 70)]);
  const history = [];
  const random = seededRandom("long-session");
  for (let i = 0; i < 50; i++) {
    const next = nextEndlessRound(pairs, history, random);
    assert.ok(next);
    if (history.length) assert.notEqual(next.metric, history.at(-1)!.metric);
    history.push(next);
  }
  assert.match(shareText({ score: 30, total: 50, mode: "endless", url: "https://example.com" }), /Endless\nScore 30\/50/);
  assert.match(shareText({ score: 3, url: "https://example.com" }), /Score 3\/5/);
});
