"use client";

import { useCallback, useEffect, useState } from "react";
import type { Company, Mode } from "@/types/company";
import { buildDailyRun, dailyNumber } from "@/lib/game/daily";
import { METRICS } from "@/lib/game/metrics";
import { firstStep, nextStep, type Step } from "@/lib/game/sequence";
import { rankTitle, shareText } from "@/lib/game/share";
import { VELHO_URL } from "@/lib/velho";
import { YourCompany } from "@/components/ranking/YourCompany";
import { PageTitle } from "@/components/layout/PageTitle";
import { TopBar, type GameId } from "@/components/layout/TopBar";
import { Icon, type IconName } from "@/components/ui/Icon";
import { CompanyPanel } from "./CompanyPanel";
import { RollingNumber } from "./RollingNumber";
import { VelhoTip } from "./VelhoTip";

type Phase = "guess" | "rolling" | "revealed" | "done";
/** "saved": wrong, but the once-per-game Velho save kept the streak alive. */
type Outcome = "hit" | "saved" | "miss";

/** Endless mode avoids repeating any of the last few companies. */
const ENDLESS_MEMORY = 5;

function bestKey(mode: Mode) {
  return `tehokas-best-${mode}`;
}

function readBest(mode: Mode): number {
  try {
    return Number(localStorage.getItem(bestKey(mode))) || 0;
  } catch {
    return 0;
  }
}

function writeBest(mode: Mode, value: number) {
  try {
    localStorage.setItem(bestKey(mode), String(value));
  } catch {
    // Private mode or blocked storage: the best score just isn't remembered.
  }
}

function startEndless(pool: Company[]): Step[] {
  const first = firstStep(pool, Math.random);
  const second = nextStep(pool, first.company, 1, new Set([first.company.id]), Math.random);
  return second ? [first, second] : [first];
}

const OUTCOME_UI: Record<Outcome, { icon: IconName; badgeClass: string; message: string }> = {
  hit: { icon: "check", badgeClass: "bg-sage text-ivory", message: "Correct." },
  saved: { icon: "spark", badgeClass: "bg-sky text-navy", message: "Wrong, but Velho saved you. That was your one save." },
  miss: { icon: "cross", badgeClass: "bg-clay text-ivory", message: "Not quite." },
};

type Props = {
  companies: Company[];
  onGameChange: (game: GameId) => void;
};

/** Higher or lower: guess whether the next company earns more or less per employee. */
export function Game({ companies, onGameChange }: Props) {
  const [mode, setMode] = useState<Mode>("daily");
  const [steps, setSteps] = useState<Step[]>([]);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("guess");
  const [outcome, setOutcome] = useState<Outcome>("hit");
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [saveUsed, setSaveUsed] = useState(false);
  const [perfect, setPerfect] = useState(false);
  const [tipUsed, setTipUsed] = useState(false);
  const [tipOpen, setTipOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const start = useCallback(
    (next: Mode) => {
      setMode(next);
      setSteps(next === "daily" ? buildDailyRun(companies) : startEndless(companies));
      setIndex(0);
      setPhase("guess");
      setStreak(0);
      setBest(readBest(next));
      setSaveUsed(false);
      setPerfect(false);
      setTipUsed(false);
      setTipOpen(false);
      setCopied(false);
    },
    [companies],
  );

  // The run depends on the date and Math.random, so build it on the client only.
  useEffect(() => start("daily"), [start]);

  const topBar = (
    <TopBar
      game="higherLower"
      onGameChange={onGameChange}
      status={`Streak ${streak} · Best ${best} · Save ${saveUsed ? "used" : "ready"}`}
      controls={
        <div className="flex rounded-full border border-line-dark p-0.5 text-xs md:text-sm">
          {(["daily", "endless"] as const).map((m) => (
            <button
              key={m}
              onClick={() => start(m)}
              className={`rounded-full px-3 py-1 capitalize transition ${
                mode === m ? "bg-ivory text-navy" : "text-on-dark hover:text-ivory"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      }
    />
  );

  const left = steps[index]?.company;
  const right = steps[index + 1];
  if (!left || !right) return <div className="flex min-h-0 flex-1 flex-col">{topBar}</div>;

  const metric = METRICS[right.metric];
  const velhoRound = right.metric === "manualAds";

  const guess = (dir: "higher" | "lower") => {
    const l = metric.value(left)!;
    const r = metric.value(right.company)!;
    const correct = dir === "higher" ? r > l : r < l;
    if (correct) {
      setOutcome("hit");
      setStreak((s) => s + 1);
    } else if (!saveUsed) {
      setOutcome("saved");
      setSaveUsed(true);
    } else {
      setOutcome("miss");
    }
    setTipOpen(false);
    setPhase("rolling");
  };

  const finish = (completedRun: boolean) => {
    setPerfect(completedRun);
    setPhase("done");
    if (streak > best) {
      setBest(streak);
      writeBest(mode, streak);
    }
  };

  const advance = () => {
    if (outcome === "miss") return finish(false);
    if (mode === "endless") {
      const recent = new Set(steps.slice(-ENDLESS_MEMORY).map((s) => s.company.id));
      const next = nextStep(companies, right.company, steps.length, recent, Math.random);
      if (!next) return finish(true);
      setSteps((prev) => [...prev, next]);
    } else if (index + 2 >= steps.length) {
      return finish(true);
    }
    setIndex((i) => i + 1);
    setPhase("guess");
  };

  const share = async () => {
    const text = shareText({ mode, streak, savedByVelho: saveUsed, url: window.location.origin });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      window.prompt("Copy your result:", text);
    }
  };

  if (phase === "done") {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        {topBar}
        <main className="mx-auto flex max-w-[760px] flex-col gap-8 px-4 pb-14">
          <PageTitle
            compact
            title={perfect ? "Run cleared" : "Streak over"}
            eyebrow={mode === "daily" ? `Higher or lower · Daily No. ${dailyNumber()}` : "Higher or lower · Endless"}
          />
          <section className="card animate-rise p-8 text-center">
            <p className="text-[clamp(72px,10vw,112px)] font-semibold leading-none tracking-[-0.05em]">{streak}</p>
            <p className="mt-3 text-2xl font-semibold tracking-tight">{rankTitle(streak)}</p>
            <p className="mt-2 font-mono text-xs text-ink-3">
              Best {Math.max(best, streak)}
              {saveUsed && " · saved once by Velho"}
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <button onClick={share} className="btn btn-dark">
                {copied ? "Copied" : "Share result"}
              </button>
              <button onClick={() => start("endless")} className="btn btn-line">
                {mode === "endless" ? "Try again" : "Play endless"} <Icon name="arrowRight" />
              </button>
            </div>
          </section>
          <YourCompany companies={companies} />
          <section className="rounded-[14px] bg-navy p-7 text-ivory md:p-9">
            <p className="eyebrow text-sky">Velho</p>
            <h2 className="mt-3 text-[clamp(26px,3vw,38px)] tracking-[-0.03em]">
              Less manual work. More room to <span className="text-sky">grow.</span>
            </h2>
            <a href={VELHO_URL} target="_blank" rel="noreferrer" className="btn btn-light mt-6">
              Go to Velho <Icon name="arrowRight" />
            </a>
          </section>
        </main>
      </div>
    );
  }

  const ui = phase === "revealed" ? OUTCOME_UI[outcome] : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {topBar}

      <div className="relative flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="eyebrow absolute left-1/2 top-4 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-ivory px-4 py-2 text-navy shadow-xl">
          {velhoRound ? (
            <span className="text-clay">Velho round · Manual work in job ads</span>
          ) : mode === "daily" ? (
            `Daily No. ${dailyNumber()} · Revenue per employee`
          ) : (
            "Endless · Revenue per employee"
          )}
        </div>

        <CompanyPanel company={left} metric={right.metric} revealed />

        <div
          key={ui ? outcome : "vs"}
          className={`absolute left-1/2 top-1/2 z-10 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full font-mono text-sm shadow-2xl ring-4 ring-navy md:h-16 md:w-16 ${
            ui ? `animate-pop ${ui.badgeClass}` : "bg-ivory text-navy"
          }`}
        >
          {ui ? <Icon name={ui.icon} className="h-6 w-6" /> : "VS"}
        </div>

        <CompanyPanel
          company={right.company}
          metric={right.metric}
          revealed={phase === "revealed"}
          value={
            phase === "guess" ? (
              <span className="text-on-dark-2">?</span>
            ) : (
              <RollingNumber
                value={metric.value(right.company)!}
                format={metric.format}
                onDone={() => setPhase("revealed")}
              />
            )
          }
        >
          {phase === "guess" && (
            <div className="flex flex-col items-center gap-3">
              <p className="max-w-xs text-sm text-on-dark">
                {velhoRound ? "More or less manual work in its job ads than " : "More or less per employee than "}
                <strong className="text-ivory">{left.name}</strong>?
              </p>
              <div className="flex gap-3">
                <button onClick={() => guess("higher")} className="btn btn-light">
                  <Icon name="arrowUp" /> {metric.higherLabel}
                </button>
                <button onClick={() => guess("lower")} className="btn btn-line-dark">
                  <Icon name="arrowDown" /> {metric.lowerLabel}
                </button>
              </div>
              <VelhoTip
                left={left}
                right={right.company}
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
            <div className="animate-rise flex flex-col items-center gap-3">
              <p className="text-[17px] font-semibold">{ui.message}</p>
              <button onClick={advance} className="btn btn-light">
                {outcome === "miss" ? "See result" : "Next"} <Icon name="arrowRight" />
              </button>
            </div>
          )}
        </CompanyPanel>
      </div>
    </div>
  );
}
