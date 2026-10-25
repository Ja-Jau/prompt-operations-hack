"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Game } from "./engine";
import type { Score } from "./score";
import { track } from "./analytics";
import { Cta } from "./Cta";
import { t } from "./strings";

const fmt = (n: number) => n.toLocaleString("en-US").replace(/,/g, " ");

/** Tiny before/after chart: orders waiting over time, doing nothing vs. the player. */
function Spark({ you, base }: { you: Game; base: Game }) {
  const W = 300, H = 100;
  const peak = (g: Game) => Math.max(0, ...g.history.map((s) => s.wip));
  const max = Math.max(10, peak(base), peak(you));
  const dur = you.scn.durationSeconds;
  const line = (g: Game) =>
    g.history.map((s) => `${((s.t / dur) * W).toFixed(1)},${(H - 4 - (s.wip / max) * (H - 10)).toFixed(1)}`).join(" ");
  return (
    <svg className="bn-spark" viewBox={`0 0 ${W} ${H}`} role="img" preserveAspectRatio="none"
      aria-label={`${t.beforeAfter}. Doing nothing peaks at ${peak(base)}, you peak at ${peak(you)}.`}>
      <polyline points={line(base)} fill="none" stroke="#a0533c" strokeWidth="2" strokeDasharray="5 3" vectorEffect="non-scaling-stroke" />
      <polyline points={line(you)} fill="none" stroke="#0a1b34" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

type Props = {
  g: Game;
  base: Game;
  score: Score;
  level: number;
  levels: number;
  totalScore: number;
  levelsWon: number;
  bestCut: number;
  onNext: () => void;
  onRetry: () => void;
  onRestart: () => void;
};

export function Results({ g, base, score, level, levels, totalScore, levelsWon, bestCut, onNext, onRetry, onRestart }: Props) {
  const failed = g.over !== null;
  const last = level === levels - 1;
  const showCta = failed || last;
  const stuckAt = g.scn.stages[g.overStage ?? 0];
  const annual = fmt(Math.round(score.savedAnnual / 1000) * 1000 || score.savedAnnual);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    track("level_complete", { scenario: g.scn.id, failed, score: score.total, costCutPct: score.costCutPct, timeToFind: score.timeToFind });
    if (showCta) track("cta_view", { scenario: g.scn.id });
  }, [g, failed, score, showCta]);

  const share = async () => {
    track("share_click", { scenario: g.scn.id });
    const text = `${t.share.line(annual)} ${window.location.origin}/fix-the-bottleneck?seed=${g.seed}&difficulty=${g.scn.meta?.difficulty ?? 1}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      window.prompt("Copy this:", text);
    }
  };

  const cut = Math.max(bestCut, score.costCutPct);
  return (
    <section className="bn-results" aria-labelledby="bn-res-h">
      <p className="eyebrow">{t.levelLabel(level + 1, levels)} · {g.scn.title}</p>
      <h2 id="bn-res-h">{failed ? t.gameOverTitle : t.levelDone}</h2>
      <p>
        {failed
          ? t.gameOverBody(stuckAt.name)
          : score.timeToFind !== null
            ? `${t.found(Math.round(score.timeToFind))} ${t.saved(annual)}`
            : t.notFound}
        {g.skippedAt !== null && ` ${t.skipped(Math.round(g.skippedAt))}`}
      </p>
      <p className="bn-note">{t.meta(g.seed, g.scn.meta?.difficulty ?? 0, g.scn.title)}</p>

      <div className="bn-stats">
        <div><small>{t.stats.score}</small><strong>{score.total}</strong></div>
        <div><small>{t.stats.cut}</small><strong>{score.costCutPct}%</strong></div>
        <div><small>{t.stats.cleared}</small><strong>{score.clearedDelta >= 0 ? "+" : ""}{score.clearedDelta}</strong></div>
        <div><small>{t.stats.agents}</small><strong>{score.agentsUsed}/{g.scn.agents}{g.moves > 0 ? ` · ${g.moves}↔` : ""}</strong></div>
      </div>

      <h3 className="eyebrow">{t.beforeAfter}</h3>
      <Spark you={g} base={base} />
      <div className="bn-legend">
        <span><i style={{ background: "#a0533c" }} />{t.legendBase}</span>
        <span><i style={{ background: "#0a1b34" }} />{t.legendYou}</span>
      </div>

      <div className="bn-explain"><b>{t.whatHappened}</b>{g.scn.explain.text}</div>
      <p className="bn-note">{t.illustrative}</p>

      <div className="bn-actions">
        {!failed && !last && <button className="btn btn-dark" onClick={onNext}>{t.nextLevel}</button>}
        {failed && <button className="btn btn-dark" onClick={onRetry}>{t.tryAgain}</button>}
        {last && !failed && <button className="btn btn-line" onClick={onRestart}>{t.playAgain}</button>}
        <button className="btn btn-line" onClick={share}>{copied ? t.share.copied : t.share.button}</button>
      </div>

      {showCta && (
        <>
          <Cta g={g} score={score} totalScore={totalScore} levelsWon={levelsWon}
            headline={cut === 0 ? t.headlineFail : t.headline(cut, g.scn.processName)} />
          <p className="bn-note">
            {t.otherGames}: <Link href="/" className="underline">Who&apos;s hiring? · Higher or lower</Link>
          </p>
        </>
      )}
    </section>
  );
}
