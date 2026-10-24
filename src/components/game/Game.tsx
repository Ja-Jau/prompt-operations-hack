"use client";

import { useCallback, useEffect, useState } from "react";
import type { Company, Mode } from "@/types/company";
import { buildDailyRun } from "@/lib/game/daily";
import { METRICS } from "@/lib/game/metrics";
import { firstStep, nextStep, type Step } from "@/lib/game/sequence";
import { rankTitle, shareText } from "@/lib/game/share";
import { YourCompany } from "@/components/ranking/YourCompany";
import { CompanyPanel } from "./CompanyPanel";
import { RollingNumber } from "./RollingNumber";
import { TopBar } from "./TopBar";
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

const OUTCOME_UI: Record<Outcome, { badge: string; badgeClass: string; message: string }> = {
  hit: { badge: "✓", badgeClass: "bg-emerald-400 text-neutral-900", message: "✅ Correct!" },
  saved: { badge: "⚡", badgeClass: "bg-amber-300 text-neutral-900", message: "⚡ Wrong, but Velho saved you. No more saves." },
  miss: { badge: "✗", badgeClass: "bg-rose-500 text-white", message: "❌ Not quite." },
};

export function Game({ companies, unverifiedCount }: { companies: Company[]; unverifiedCount: number }) {
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
      mode={mode}
      streak={streak}
      best={best}
      saveAvailable={!saveUsed}
      unverifiedCount={unverifiedCount}
      onModeChange={start}
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
      <div className="flex min-h-0 flex-1 flex-col">
        {topBar}
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto bg-[radial-gradient(ellipse_at_top,rgb(252_211_77/0.12),transparent_60%)] px-4 py-6">
          <div className="grid w-full max-w-5xl items-center gap-8 md:grid-cols-2">
            <div className="animate-rise flex flex-col items-center gap-4 text-center">
              <p className="text-sm uppercase tracking-[0.25em] text-white/50">
                {perfect ? "You cleared today's run" : mode === "daily" ? "Today's streak" : "Streak over"}
              </p>
              <p className="text-8xl font-black text-amber-300 drop-shadow-[0_0_40px_rgb(252_211_77/0.35)]">
                🔥 {streak}
              </p>
              <p className="text-2xl font-bold">{rankTitle(streak)}</p>
              <p className="text-sm text-white/50">
                Best {Math.max(best, streak)}
                {saveUsed && " · ⚡ saved once by Velho"}
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  onClick={share}
                  className="rounded-full bg-amber-300 px-6 py-3 font-semibold text-neutral-900 transition hover:bg-amber-200"
                >
                  {copied ? "Copied!" : "Share result"}
                </button>
                <button
                  onClick={() => start("endless")}
                  className="rounded-full border border-white/20 px-6 py-3 font-semibold transition hover:bg-white/10"
                >
                  {mode === "endless" ? "Try again" : "Play endless mode"}
                </button>
              </div>
              <p className="max-w-sm text-sm text-white/60">
                The companies at the top get more done per person. Velho helps companies climb this list by freeing
                up time from manual work.
              </p>
            </div>
            <YourCompany companies={companies} />
          </div>
        </div>
      </div>
    );
  }

  const ui = phase === "revealed" ? OUTCOME_UI[outcome] : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {topBar}

      <div className="relative flex min-h-0 flex-1 flex-col md:flex-row">
        {velhoRound && (
          <div className="animate-rise absolute left-1/2 top-3 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-300 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-neutral-900 shadow-xl md:text-sm">
            ⚡ Velho round · manual work in job ads
          </div>
        )}

        <CompanyPanel company={left} metric={right.metric} revealed />

        <div
          key={ui ? outcome : "vs"}
          className={`absolute left-1/2 top-1/2 z-10 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-lg font-black shadow-2xl ring-4 ring-neutral-950/60 md:h-16 md:w-16 md:text-xl ${
            ui ? `animate-pop ${ui.badgeClass}` : "bg-white text-neutral-900"
          }`}
        >
          {ui ? ui.badge : "VS"}
        </div>

        <CompanyPanel
          company={right.company}
          metric={right.metric}
          revealed={phase === "revealed"}
          value={
            phase === "guess" ? (
              <span className="text-white/40">?</span>
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
              <p className="max-w-xs text-sm text-white/80">
                {velhoRound ? "More or less manual work in its job ads than " : "More or less per employee than "}
                <strong>{left.name}</strong>?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => guess("higher")}
                  className="rounded-full border-2 border-white bg-white/10 px-6 py-2 font-bold backdrop-blur transition hover:-translate-y-0.5 hover:bg-emerald-400 hover:text-neutral-900 md:px-7 md:py-3 md:text-lg"
                >
                  ▲ {metric.higherLabel}
                </button>
                <button
                  onClick={() => guess("lower")}
                  className="rounded-full border-2 border-white bg-white/10 px-6 py-2 font-bold backdrop-blur transition hover:-translate-y-0.5 hover:bg-rose-400 hover:text-neutral-900 md:px-7 md:py-3 md:text-lg"
                >
                  ▼ {metric.lowerLabel}
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
            <div className="animate-rise flex flex-col items-center gap-2">
              <p className="text-base font-bold md:text-lg">{ui.message}</p>
              <button
                onClick={advance}
                className="rounded-full bg-white px-8 py-2 font-semibold text-neutral-900 transition hover:bg-white/90 md:py-3"
              >
                {outcome === "miss" ? "See result" : "Next →"}
              </button>
            </div>
          )}
        </CompanyPanel>
      </div>
    </div>
  );
}
