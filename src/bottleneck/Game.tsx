"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Play } from "./Play";
import { Results } from "./Results";
import { useRun } from "./useRun";
import { LEVELS } from "./genCommon";
import { LEVELS_PER_RUN, RUN_DIFFICULTY, readUrlParams, type UrlParams } from "./runPlan";
import { t } from "./strings";
import "./bottleneck.css";
import "./bottleneck.pipeline.css";
import "./bottleneck.layout.css";
import "./bottleneck.results.css";

const ZERO = { score: 0, won: 0, bestCut: 0 };
const SECONDS = RUN_DIFFICULTY.slice(0, LEVELS_PER_RUN).map((d) => LEVELS[d].seconds);

export function Game() {
  const [started, setStarted] = useState(false);
  const [announce, setAnnounce] = useState("");
  const [url, setUrl] = useState<UrlParams>({ seed: null, difficulty: null, debug: false });
  const [totals, setTotals] = useState(ZERO);
  const [counted, setCounted] = useState<unknown>(null);

  useEffect(() => setUrl(readUrlParams(window.location.search)), []);

  const say = useCallback((s: string) => setAnnounce(s), []);
  const run = useRun(url, say);
  const { g, playing, level, done } = run;

  // Add a finished level to the running totals exactly once.
  useEffect(() => {
    if (!done || counted === done) return;
    setCounted(done);
    setTotals((p) => ({
      score: p.score + done.score.total,
      won: p.won + (done.score.won ? 1 : 0),
      bestCut: Math.max(p.bestCut, done.score.survived ? done.score.costCutPct : 0),
    }));
  }, [done, counted]);

  // Keyboard: 1-8 pick a step (and place the selected agent), A cycles agents, B benches, P pauses, Esc clears.
  const { selAgent, selStage, setSelAgent, setSelStage, place, bench, togglePause } = run;
  useEffect(() => {
    if (!playing || !g) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const k = e.key.toLowerCase();
      const n = Number(k);
      if (n >= 1 && n <= g.scn.stages.length) {
        if (selAgent !== null) place(selAgent, n - 1);
        setSelStage(n - 1);
      } else if (k === "a") {
        const ids = g.agents.map((a) => a.id);
        const next = selAgent === null ? ids[0] : ids[(ids.indexOf(selAgent) + 1) % ids.length];
        setSelAgent(next);
        setAnnounce(t.agent.selected(next + 1));
      } else if (k === "b" && selAgent !== null) bench(selAgent);
      else if (k === "p") togglePause();
      else if (k === "escape") setSelAgent(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playing, g, selAgent, setSelAgent, setSelStage, place, bench, togglePause]);

  const restart = () => {
    setTotals(ZERO);
    setStarted(true);
    run.start(0);
  };

  return (
    <div className="bn-root">
      <header className="bn-bar">
        <span className="bn-brand">{t.appName}</span>
        <span className="eyebrow" style={{ color: "var(--color-on-dark-2)" }}>by Velho</span>
        <Link href="/" style={{ marginLeft: "auto" }}>{t.backToGames}</Link>
      </header>
      <div className="bn-sr" aria-live="polite" role="status">{announce}</div>

      <main className="bn-main">
        {!started && (
          <section className="bn-center">
            <div>
              <p className="eyebrow">Velho · {Math.min(...SECONDS)}–{Math.max(...SECONDS)} seconds a level</p>
              <h1>{t.introTitle}</h1>
              <p>{t.introBody}</p>
              <ul className="bn-steps">{t.howTo.map((s) => <li key={s}>{s}</li>)}</ul>
              <p className="bn-note">{t.introLength(LEVELS_PER_RUN, Math.min(...SECONDS), Math.max(...SECONDS))}</p>
              <button className="btn btn-dark bn-big" onClick={restart}>{t.start}</button>
            </div>
          </section>
        )}
        {started && playing && g && (
          <Play g={g} level={level} levels={LEVELS_PER_RUN} selStage={selStage} selAgent={selAgent}
            setSelStage={setSelStage} setSelAgent={setSelAgent} place={place} bench={bench}
            speed={run.speed} setSpeed={run.setSpeed} paused={run.paused} togglePause={togglePause}
            skip={run.skip} debug={url.debug} tickMs={run.tickMs} />
        )}
        {started && !playing && done && (
          <Results g={done.g} base={done.base} score={done.score} level={level} levels={LEVELS_PER_RUN}
            totalScore={totals.score} levelsWon={totals.won} bestCut={totals.bestCut}
            onNext={() => run.start(level + 1)} onRetry={() => run.start(level, 1)} onRestart={restart} />
        )}
      </main>
    </div>
  );
}
