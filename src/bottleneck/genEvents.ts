/** Picks 2-4 mid-game events from events.json with randomised timing, targets and strength. */
import { nextRandom } from "./rng";
import type { EffectDef, EventDef, StageDef } from "./engine";
import { EVENT_POOL, fill, r1, r2, rint, rnd, shuffle, type H, type Level, type Theme } from "./genCommon";

export function buildEvents(
  h: H, theme: Theme, stages: StageDef[], midIdx: number[], bn: number, d: number, dur: number, L: Level,
): EventDef[] {
  const eligible = shuffle(h, EVENT_POOL.filter((e) => e.minDifficulty <= d));
  const count = Math.min(eligible.length, rint(h, L.events[0], L.events[1]));
  const chosen = eligible.slice(0, count);
  const lo = dur * 0.2, span = dur * 0.65;
  const times = chosen.map((_, k) => lo + (span * (k + nextRandom(h) * 0.8)) / Math.max(1, count)).sort((a, b) => a - b);

  return chosen.map((tpl, k) => {
    const value = r2(rnd(h, tpl.value[0], tpl.value[1]));
    const duration = rint(h, tpl.duration[0], tpl.duration[1]);
    let cands: number[] = midIdx;
    if (tpl.target === "manual") cands = midIdx.filter((i) => stages[i].kind === "manual");
    if (tpl.target === "early") cands = midIdx.slice(0, Math.ceil(midIdx.length / 2));
    if (tpl.target === "automated") cands = stages.map((_, i) => i).filter((i) => stages[i].kind !== "manual");
    if (!cands.length) cands = midIdx;
    const away = cands.filter((i) => i !== bn);
    if (away.length && nextRandom(h) < 0.6) cands = away; // most events move pressure to a different stage
    const st = stages[cands[Math.floor(nextRandom(h) * cands.length)]];
    const pct =
      tpl.kind === "inflowMult" ? Math.round((value - 1) * 100)
      : tpl.kind === "stageErrorAdd" ? Math.round(value * 100)
      : Math.round((1 - value) * 100);
    const vars = { stage: st.name, unit: theme.unit, pct: String(pct) };
    const effect: EffectDef =
      tpl.kind === "inflowMult" ? { type: "inflowMult", value, duration }
      : tpl.kind === "stageErrorAdd" ? { type: "stageErrorAdd", stage: st.id, value, duration }
      : { type: "stageRateMult", stage: st.id, value, duration, onlyManual: !!tpl.onlyManual };
    return { id: `${tpl.id}-${k}`, at: r1(times[k]), title: fill(tpl.title, vars), text: fill(tpl.text, vars), effects: [effect] };
  });
}
