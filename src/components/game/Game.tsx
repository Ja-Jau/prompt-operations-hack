"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { GameCompany as Company } from "@/types/company";
import { METRICS } from "@/lib/game/metrics";
import { availableRounds, buildRandomRun, nextEndlessRound, type Round } from "@/lib/game/sequence";
import { shareText } from "@/lib/game/share";
import { TopBar, type GameId } from "@/components/layout/TopBar";
import { Icon, type IconName } from "@/components/ui/Icon";
import { CompanyPanel } from "./CompanyPanel";
import { RollingNumber } from "./RollingNumber";
import { RunResult } from "./RunResult";
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
    return (
      <div className="higher-lower flex min-h-0 flex-1 flex-col overflow-y-auto">
        {topBar}
        <RunResult
          last={rounds[index]?.right}
          score={score}
          total={mode === "five" ? 5 : answered}
          best={best}
          mode={mode}
          copied={copied}
          onPlayAgain={() => start(mode)}
          onShare={share}
          onPlayFirmle={() => onGameChange("case")}
        />
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
