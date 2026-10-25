import assert from "node:assert/strict";
import { test } from "node:test";
import { buildOfficeDay, currentEncounter, missedEncounters, OFFICE_DAY_SECONDS, OFFICE_DECISION_SECONDS, officeClock, officeZone, approachVelocity } from "../src/lib/ceo/day";
import { evaluateDecision } from "../src/lib/ceo/game";
import { seededRandom } from "../src/lib/game/random";

test("the five-minute office day progresses from arrival to billing, lunch and the boardroom", () => {
  const day = buildOfficeDay(seededRandom("office"));
  assert.equal(OFFICE_DAY_SECONDS, 300);
  assert.equal(day.length, 7);
  assert.equal(day[0].room, "Reception");
  assert.equal(day[1].scenario.id, "billing");
  assert.equal(day.find((event) => event.id === "lunch")?.role, "CFO");
  assert.equal(day.at(-1)?.room, "Boardroom");
  for (const [index, event] of day.entries()) {
    assert.ok(event.until - event.at >= OFFICE_DECISION_SECONDS + 10);
    assert.equal(event.until, day[index + 1]?.at ?? OFFICE_DAY_SECONDS);
    assert.equal(currentEncounter(day, [], event.at)?.id, event.id);
    assert.equal(currentEncounter(day, [], event.until - 0.01)?.id, event.id);
    assert.equal(event.scenario.choices.filter((choice) => choice.correct).length, 1);
    assert.equal(officeZone(event.position), event.room === "Reception" ? "Reception" : event.room);
  }
  assert.equal(currentEncounter(day, [], 300), null);
});

test("answered encounters do not reopen and unanswered appointments expire", () => {
  const day = buildOfficeDay();
  const first = day[0];
  const answer = evaluateDecision(first.scenario, first.scenario.choices.find((choice) => choice.correct)!.id, 1000);
  assert.equal(currentEncounter(day, [answer], 20), null);
  assert.deepEqual(missedEncounters(day, [answer], 40), []);
  assert.equal(missedEncounters(day, [], 40)[0].id, first.id);
  assert.equal(missedEncounters(day, [answer], 300).length, 6);
});

test("the day keeps its narrative order while shuffling the three choices", () => {
  const random = seededRandom("office-choices");
  const slots = new Set<number>();
  for (let i = 0; i < 20; i++) {
    const day = buildOfficeDay(random);
    assert.equal(new Set(day.map((event) => event.scenario.id)).size, 7);
    day.forEach((event) => slots.add(event.scenario.choices.findIndex((choice) => choice.correct)));
  }
  assert.equal(slots.size, 3);
});

test("office clock and movement acceleration are bounded and independent of frame rate", () => {
  assert.equal(officeClock(-1), "09:00");
  assert.equal(officeClock(150), "13:00");
  assert.equal(officeClock(300), "17:00");
  assert.equal(officeClock(600), "17:00");
  let manyFrames = 0;
  for (let i = 0; i < 60; i++) manyFrames = approachVelocity(manyFrames, 2.8, 1 / 60);
  assert.ok(Math.abs(manyFrames - approachVelocity(0, 2.8, 1)) < 1e-10);
});
