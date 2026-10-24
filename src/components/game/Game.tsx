"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Company } from "@/types/company";
import { METRICS } from "@/lib/game/metrics";
import { availableRounds, buildRandomRun, type Round } from "@/lib/game/sequence";
import { rankTitle, shareText } from "@/lib/game/share";
import { VELHO_URL } from "@/lib/velho";
import { TopBar, type GameId } from "@/components/layout/TopBar";
import { Icon, type IconName } from "@/components/ui/Icon";
import { CompanyPanel } from "./CompanyPanel";
import { RollingNumber } from "./RollingNumber";
import { VelhoTip } from "./VelhoTip";

type Phase = "guess" | "rolling" | "revealed" | "done";
type Outcome = "hit" | "miss";

const BEST_KEY = "tehokas-efficiency-best-five-rounds";

function readBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeBest(value: number) {
  try {
    localStorage.setItem(BEST_KEY, String(value));
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

  const start = useCallback(() => {
    setRounds(buildRandomRun(pairs));
    setIndex(0);
    setPhase("guess");
    setScore(0);
    setBest(readBest());
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
      status={`Score ${score}/5 · Best ${best}/5`}
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
    setTipOpen(false);
    setPhase("rolling");
  };

  const finish = () => {
    setPhase("done");
    if (score > best) {
      setBest(score);
      writeBest(score);
    }
  };

  const advance = () => {
    if (phase !== "revealed") return;
    if (index + 1 >= rounds.length) return finish();
    setIndex((i) => i + 1);
    setPhase("guess");
  };

  const share = async () => {
    const text = shareText({ score: score, url: window.location.origin });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      window.prompt("Copy your result:", text);
    }
  };

  if (phase === "done") {
    return (
      <div className="higher-lower flex min-h-0 flex-1 flex-col overflow-hidden">
        {topBar}
        <main className="mx-auto flex min-h-0 w-full max-w-[760px] flex-1 flex-col justify-center gap-3 p-3">
          <div className="text-center">
            <h1 className="text-3xl leading-none">Game complete</h1>
            <p className="mt-1 text-xs text-ink-3">Higher or lower · 5 rounds</p>
          </div>
          <section className="card animate-rise p-4 text-center">
            <p className="text-[clamp(48px,10dvh,88px)] font-semibold leading-none tracking-[-0.05em]">{score}/5</p>
            <p className="mt-1 text-xl font-semibold tracking-tight">{rankTitle(score)}</p>
            <p className="mt-1 font-mono text-xs text-ink-3">
              Best {Math.max(best, score)}
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <button onClick={share} className="btn btn-dark btn-sm">
                {copied ? "Copied" : "Share result"}
              </button>
              <button onClick={start} className="btn btn-line btn-sm">
                Play again <Icon name="arrowRight" />
              </button>
            </div>
          </section>
          <section className="higher-lower-promo rounded-[14px] bg-navy p-4 text-center text-ivory">
            <p className="eyebrow text-sky">Velho</p>
            <h2 className="mt-1 text-[clamp(20px,3vw,26px)] leading-tight tracking-[-0.03em]">
              Less manual work. More room to <span className="text-sky">grow.</span>
            </h2>
            <a href={VELHO_URL} target="_blank" rel="noreferrer" className="btn btn-light btn-sm mt-3">
              Go to Velho <Icon name="arrowRight" />
            </a>
          </section>
        </main>
      </div>
    );
  }

  const ui = phase === "revealed" ? OUTCOME_UI[outcome] : null;

  return (
    <div className="higher-lower flex min-h-0 flex-1 flex-col overflow-hidden">
      {topBar}

      <div className="shrink-0 bg-cream px-3 py-2 text-center">
        <p className="eyebrow text-sage-d">Round {index + 1}/{rounds.length} · {metric.title}</p>
        <p className="mx-auto mt-1 hidden max-w-2xl text-xs text-ink-2 sm:block">{metric.explanation}</p>
      </div>
      <div className="higher-lower-board relative flex min-h-0 flex-1 flex-col overflow-hidden sm:flex-row">

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
                key={`${index}-${round.metric}`}
                value={metric.value(right)!}
                format={metric.format}
                onDone={() => setPhase("revealed")}
              />
            )
          }
        >
          {phase === "guess" && (
            <div className="flex flex-col items-center gap-2">
              <p className="max-w-xs text-xs text-on-dark sm:text-sm">
                {metric.question}{" "}
                <strong className="text-ivory">{left.name}</strong>?
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
              <p className="hidden max-w-sm text-sm text-on-dark sm:block">{metric.opportunity}</p>
              <button onClick={advance} className="btn btn-light btn-sm">
                {index + 1 >= rounds.length ? "See result" : "Next"} <Icon name="arrowRight" />
              </button>
            </div>
          )}
        </CompanyPanel>
      </div>
    </div>
  );
}
