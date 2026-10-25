"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { GameCompany as Company } from "@/types/company";
import { METRICS } from "@/lib/game/metrics";
import { availableRounds, buildRandomRun, nextEndlessRound, type Round } from "@/lib/game/sequence";
import { rankTitle, shareText } from "@/lib/game/share";
import { VELHO_URL } from "@/lib/velho";
import { TopBar, type GameId } from "@/components/layout/TopBar";
import { Icon, type IconName } from "@/components/ui/Icon";
import { CompanyPanel } from "./CompanyPanel";
import { RollingNumber } from "./RollingNumber";
import { VelhoTip } from "./VelhoTip";

type Phase = "guess" | "rolling" | "revealed" | "done";
type Outcome = "hit" | "miss";

type GameMode = "five" | "endless";
const bestKey = (mode: GameMode) => `tehokas-efficiency-best-${mode === "five" ? "five-rounds" : "endless-score"}`;

function readBest(mode: GameMode): number {
  try {
    return Number(localStorage.getItem(bestKey(mode))) || 0;
  } catch {
    return 0;
  }
}

function writeBest(mode: GameMode, value: number) {
  try {
    localStorage.setItem(bestKey(mode), String(value));
  } catch {
    // Private mode or blocked storage: the best score just isn't remembered.
  }
}

const OUTCOME_UI: Record<Outcome, { icon: IconName; badgeClass: string; message: string }> = {
  hit: { icon: "check", badgeClass: "bg-sage text-ivory", message: "Correct." },
  miss: { icon: "cross", badgeClass: "bg-clay text-ivory", message: "Not quite." },
};

type Props = {
  companies: Company[];
  onGameChange: (game: GameId) => void;
};

/** Higher or lower: sourced efficiency signals, a random category every question. */
export function Game({ companies, onGameChange }: Props) {
  const [mode, setMode] = useState<GameMode>("five");
  const [answered, setAnswered] = useState(0);
  const [rounds, setRounds] = useState<Round[]>([]);
  const pairs = useMemo(() => availableRounds(companies), [companies]);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("guess");
  const [outcome, setOutcome] = useState<Outcome>("hit");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [tipUsed, setTipUsed] = useState(false);
  const [tipOpen, setTipOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const start = useCallback((nextMode: GameMode = "five") => {
    setMode(nextMode);
    setAnswered(0);
    const first = nextMode === "endless" ? nextEndlessRound(pairs, [], Math.random) : null;
    setRounds(nextMode === "five" ? buildRandomRun(pairs) : first ? [first] : []);
    setIndex(0);
    setPhase("guess");
    setScore(0);
    setBest(readBest(nextMode));
    setTipUsed(false);
    setTipOpen(false);
    setCopied(false);
  }, [pairs]);

  // Random runs are generated on the client after mounting.
  useEffect(() => start(), [start]);

  const topBar = (
    <TopBar
      game="higherLower"
      onGameChange={onGameChange}
      status={mode === "five" ? `Score ${score}/5 · Best ${best}/5` : `Score ${score}/${answered} · Best ${best}`}
      controls={
        <div className="flex items-center gap-2">
          <div className="flex rounded-full border border-line-dark p-0.5 text-xs">
            {(["five", "endless"] as const).map((option) => (
              <button
                key={option}
                aria-pressed={mode === option}
                onClick={() => start(option)}
                className={`rounded-full px-3 py-1 transition ${mode === option ? "bg-ivory text-navy" : "text-on-dark hover:text-ivory"}`}
              >
                {option === "five" ? "5 rounds" : "Endless"}
              </button>
            ))}
          </div>
          {mode === "endless" && phase !== "done" && (
            <button disabled={phase === "rolling" || answered === 0} onClick={finish} className="text-xs text-ivory disabled:opacity-40">Finish</button>
          )}
        </div>
      }
    />
  );

  const round = rounds[index];
  if (!round) return (
    <div className="higher-lower flex min-h-0 flex-1 flex-col overflow-hidden">
      {topBar}
      {pairs.length === 0 && (
        <div className="m-auto max-w-md px-4 text-center">
          <h1 className="text-3xl">More evidence needed</h1>
          <p className="mt-3 text-ink-2">There aren’t enough sourced company figures for a fair comparison yet. Try today’s hiring case.</p>
          <button onClick={() => onGameChange("case")} className="btn btn-dark mt-6">Play who’s hiring?</button>
        </div>
      )}
    </div>
  );
  const { left, right } = round;

  const metric = METRICS[round.metric];

  const guess = (dir: "higher" | "lower") => {
    if (phase !== "guess") return;
    const l = metric.value(left)!;
    const r = metric.value(right)!;
    const correct = dir === "higher" ? r > l : r < l;
    if (correct) {
      setOutcome("hit");
      setScore((s) => s + 1);
    } else {
      setOutcome("miss");
    }
    setAnswered((count) => count + 1);
    setTipOpen(false);
    setPhase("rolling");
  };

  function finish() {
    setPhase("done");
    if (score > best) {
      setBest(score);
      writeBest(mode, score);
    }
  };

  const advance = () => {
    if (phase !== "revealed") return;
    if (mode === "endless") {
      const next = nextEndlessRound(pairs, rounds, Math.random);
      if (!next) return finish();
      setRounds((previous) => [...previous, next]);
    } else if (index + 1 >= rounds.length) return finish();
    setIndex((i) => i + 1);
    setPhase("guess");
  };

  const share = async () => {
    const text = shareText({ score, mode, total: answered, url: window.location.origin });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      window.prompt("Copy your result:", text);
    }
  };

  if (phase === "done") {
    const total = mode === "five" ? 5 : answered;
    const accuracy = total ? Math.round((score / total) * 100) : 0;

    return (
      <div className="higher-lower higher-lower-results relative isolate flex min-h-0 flex-1 flex-col overflow-hidden bg-navy text-ivory">
        {topBar}
        <main className="relative mx-auto flex min-h-0 w-full max-w-[1080px] flex-1 items-center justify-center p-3 sm:p-6">
          <div className="higher-lower-results-card animate-rise grid w-full overflow-hidden rounded-3xl border border-line-dark bg-navy-2/70 shadow-2xl md:grid-cols-[0.9fr_1.1fr]">
            <section aria-labelledby="result-title" className="higher-lower-result-score flex min-w-0 flex-col justify-center gap-4 p-5 sm:p-8 md:gap-6 md:p-10">
              <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-on-dark-2 sm:text-xs">
                <Icon name="check" className="h-4 w-4 text-sky" />
                Run complete · {mode === "five" ? "5 rounds" : "Endless"}
              </p>
              <div className="flex items-center gap-5 md:flex-col md:items-start md:gap-4">
                <p className="shrink-0 font-semibold leading-none tracking-[-0.07em]" aria-label={`${score} correct out of ${total}`}>
                  <span className="text-[clamp(64px,10dvh,120px)] text-ivory">{score}</span>
                  <span className="ml-1 text-[clamp(24px,4dvh,40px)] tracking-tight text-sky">/{total}</span>
                </p>
                <h1 id="result-title" className="max-w-xs text-[clamp(22px,3vw,36px)] leading-tight tracking-tight">{rankTitle(score)}</h1>
              </div>
              <div>
                <div className="mb-2 flex justify-between font-mono text-xs text-on-dark">
                  <span>{accuracy}% correct</span>
                  <span>Best {Math.max(best, score)}</span>
                </div>
                <div role="progressbar" aria-label="Correct answers" aria-valuemin={0} aria-valuemax={total} aria-valuenow={score} className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-sky" style={{ width: `${accuracy}%` }} />
                </div>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                <button onClick={() => start(mode)} className="inline-flex items-center gap-2 rounded py-1 text-sm font-medium text-on-dark transition hover:text-ivory focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky">
                  <Icon name="play" /> Play again
                </button>
                <button onClick={share} className="inline-flex items-center gap-2 rounded py-1 text-sm font-medium text-on-dark transition hover:text-ivory focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky">
                  <Icon name={copied ? "check" : "arrowUp"} /> {copied ? "Copied!" : "Share result"}
                </button>
              </div>
            </section>
            <section aria-labelledby="velho-next-step" className="higher-lower-result-velho relative isolate flex min-w-0 flex-col justify-center gap-4 border-t border-line-dark p-5 sm:p-8 md:gap-6 md:border-l md:border-t-0 md:p-10">
              <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-sky sm:text-xs">
                <Icon name="spark" className="h-4 w-4" /> Make your next move
              </p>
              <h2 id="velho-next-step" className="max-w-md text-[clamp(28px,4.2vw,48px)] leading-[1.08] tracking-[-0.04em]">
                Less manual work.<br /><span className="text-sky">More room to grow.</span>
              </h2>
              <p className="higher-lower-result-description max-w-sm text-sm leading-relaxed text-on-dark md:text-base">
                What could your team do with more time? Velho helps companies simplify repetitive work and make everyday operations more efficient.
              </p>
              <a href={VELHO_URL} target="_blank" rel="noopener noreferrer" className="group flex w-full items-center justify-between gap-4 rounded-xl bg-sky px-5 py-4 text-lg font-semibold text-navy shadow-[0_8px_32px_rgb(122_163_214/0.2)] transition hover:bg-ivory hover:shadow-[0_8px_40px_rgb(122_163_214/0.35)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ivory">
                Visit velho.io
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy/10 transition group-hover:translate-x-1"><Icon name="arrowRight" className="h-5 w-5" /></span>
              </a>
            </section>
          </div>
        </main>
      </div>
    );
  }

  const ui = phase === "revealed" ? OUTCOME_UI[outcome] : null;

  return (
    <div className="higher-lower flex min-h-0 flex-1 flex-col overflow-hidden">
      {topBar}

      <div className="higher-lower-board relative flex min-h-0 flex-1 flex-col overflow-hidden sm:flex-row">
        <div className="higher-lower-category pointer-events-none absolute inset-x-0 top-0 z-20 bg-transparent px-4 py-3 text-center text-ivory [text-shadow:0_2px_12px_rgb(0_0_0/0.7)] sm:py-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-on-dark sm:text-xs">Round {index + 1}{mode === "five" ? `/${rounds.length}` : " · Endless"}</p>
          <h1 className="mt-1 text-[clamp(20px,3vw,34px)] font-semibold leading-tight tracking-tight text-sky">{metric.title}</h1>
        </div>

        <CompanyPanel company={left} metric={round.metric} revealed />

        <div
          key={ui ? outcome : "vs"}
          className={`higher-lower-vs absolute left-1/2 top-1/2 z-10 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full font-mono text-xs shadow-2xl ring-2 ring-navy sm:h-12 sm:w-12 ${
            ui ? `animate-pop ${ui.badgeClass}` : "bg-ivory text-navy"
          }`}
        >
          {ui ? <Icon name={ui.icon} className="h-6 w-6" /> : "VS"}
        </div>

        <CompanyPanel
          company={right}
          metric={round.metric}
          revealed={phase === "revealed"}
          value={
            phase === "guess" ? (
              <span className="text-on-dark-2">?</span>
            ) : (
              <RollingNumber
                key={`${mode}-${index}-${round.metric}`}
                value={metric.value(right)!}
                format={metric.format}
                onDone={() => setPhase("revealed")}
              />
            )
          }
        >
          {phase === "guess" && (
            <div className="flex flex-col items-center gap-2">
              <p className="higher-lower-question max-w-md rounded-xl border border-sky/40 bg-transparent px-3 py-2 text-[clamp(17px,2.2vw,25px)] font-semibold leading-snug tracking-tight text-ivory [text-shadow:0_2px_12px_rgb(0_0_0/0.5)]">
                {metric.question}{" "}
                <strong className="text-sky">{left.name}</strong>?
              </p>
              <div className="flex gap-3">
                <button onClick={() => guess("higher")} className="btn btn-light btn-sm">
                  <Icon name="arrowUp" /> {metric.higherLabel}
                </button>
                <button onClick={() => guess("lower")} className="btn btn-line-dark btn-sm">
                  <Icon name="arrowDown" /> {metric.lowerLabel}
                </button>
              </div>
              <VelhoTip
                left={left}
                right={right}
                metric={round.metric}
                used={tipUsed}
                open={tipOpen}
                onAsk={() => {
                  setTipUsed(true);
                  setTipOpen(true);
                }}
              />
            </div>
          )}
          {ui && (
            <div className="animate-rise flex flex-col items-center gap-2">
              <p className="text-[17px] font-semibold">{ui.message}</p>
              <button onClick={advance} className="btn btn-light btn-sm">
                {mode === "five" && index + 1 >= rounds.length ? "See result" : "Next"} <Icon name="arrowRight" />
              </button>
            </div>
          )}
        </CompanyPanel>
      </div>
    </div>
  );
}
