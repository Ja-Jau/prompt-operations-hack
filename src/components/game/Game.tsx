"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Company, Mode } from "@/types/company";
import { DAILY_ROUNDS, buildDailyRun } from "@/lib/game/daily";
import { pickNext, revenuePerEmployee } from "@/lib/game/rules";
import { rankTitle, resultGrid, shareText } from "@/lib/game/share";
import { YourCompany } from "@/components/ranking/YourCompany";
import { CompanyPanel } from "./CompanyPanel";
import { RollingNumber } from "./RollingNumber";
import { TopBar } from "./TopBar";
import { VelhoTip } from "./VelhoTip";

type Phase = "guess" | "rolling" | "revealed" | "done";

/** Endless mode avoids repeating any of the last few companies. */
const ENDLESS_MEMORY = 5;

function startEndless(pool: Company[]): Company[] {
  const first = pool[Math.floor(Math.random() * pool.length)];
  const second = pickNext(pool, first, new Set([first.id]), Math.random);
  return second ? [first, second] : [first];
}

export function Game({ companies, unverifiedCount }: { companies: Company[]; unverifiedCount: number }) {
  const [mode, setMode] = useState<Mode>("daily");
  const [run, setRun] = useState<Company[]>([]);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("guess");
  const [results, setResults] = useState<boolean[]>([]);
  const [tipUsed, setTipUsed] = useState(false);
  const [tipOpen, setTipOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const lastCorrect = useRef(false);

  const start = useCallback(
    (next: Mode) => {
      setMode(next);
      setRun(next === "daily" ? buildDailyRun(companies) : startEndless(companies));
      setIndex(0);
      setPhase("guess");
      setResults([]);
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
      results={results}
      awaitingGuess={phase === "guess"}
      unverifiedCount={unverifiedCount}
      onModeChange={start}
    />
  );

  const left = run[index];
  const right = run[index + 1];
  if (!left || !right) return <div className="flex min-h-0 flex-1 flex-col">{topBar}</div>;

  const guess = (dir: "higher" | "lower") => {
    const l = revenuePerEmployee(left);
    const r = revenuePerEmployee(right);
    const correct = dir === "higher" ? r > l : r < l;
    lastCorrect.current = correct;
    setResults((prev) => [...prev, correct]);
    setTipOpen(false);
    setPhase("rolling");
  };

  const advance = () => {
    const finishedDaily = mode === "daily" && (results.length >= DAILY_ROUNDS || index + 2 >= run.length);
    const finishedEndless = mode === "endless" && !lastCorrect.current;
    if (finishedDaily || finishedEndless) {
      setPhase("done");
      return;
    }
    if (mode === "endless") {
      const recent = new Set(run.slice(-ENDLESS_MEMORY).map((c) => c.id));
      const next = pickNext(companies, right, recent, Math.random);
      if (!next) {
        setPhase("done");
        return;
      }
      setRun((prev) => [...prev, next]);
    }
    setIndex((i) => i + 1);
    setPhase("guess");
  };

  const share = async () => {
    const text = shareText({ mode, results, usedTip: tipUsed, url: window.location.origin });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      window.prompt("Copy your result:", text);
    }
  };

  const score = results.filter(Boolean).length;

  if (phase === "done") {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {topBar}
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-4 py-6">
          <div className="grid w-full max-w-5xl items-center gap-8 md:grid-cols-2">
            <div className="flex flex-col items-center gap-5 text-center">
              <p className="text-sm uppercase tracking-widest text-white/50">
                {mode === "daily" ? "Today's result" : "Streak over"}
              </p>
              <p className="text-7xl font-black">{mode === "daily" ? `${score}/${results.length}` : `🔥 ${score}`}</p>
              <p className="text-2xl tracking-widest">{resultGrid(results)}</p>
              <p className="text-2xl font-bold text-amber-300">{rankTitle(mode, results)}</p>
              <div className="flex flex-wrap justify-center gap-3">
                <button onClick={share} className="rounded-full bg-amber-300 px-6 py-3 font-semibold text-neutral-900 hover:bg-amber-200">
                  {copied ? "Copied!" : "Share result"}
                </button>
                <button onClick={() => start("endless")} className="rounded-full border border-white/20 px-6 py-3 font-semibold hover:bg-white/10">
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

  const badge =
    phase === "revealed"
      ? lastCorrect.current
        ? { text: "✓", className: "bg-emerald-400 text-neutral-900 scale-110" }
        : { text: "✗", className: "bg-rose-500 text-white scale-110" }
      : { text: "VS", className: "bg-white text-neutral-900" };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {topBar}

      <div className="relative flex min-h-0 flex-1 flex-col md:flex-row">
        <CompanyPanel company={left} revealed />

        <div
          className={`absolute left-1/2 top-1/2 z-10 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-lg font-black shadow-2xl ring-4 ring-neutral-950/60 transition-all duration-300 md:h-16 md:w-16 md:text-xl ${badge.className}`}
        >
          {badge.text}
        </div>

        <CompanyPanel
          company={right}
          revealed={phase === "revealed"}
          value={
            phase === "guess" ? (
              <span className="text-white/40">?</span>
            ) : (
              <RollingNumber value={revenuePerEmployee(right)} onDone={() => setPhase("revealed")} />
            )
          }
        >
          {phase === "guess" && (
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm text-white/80">
                more or less than <strong>{left.name}</strong>?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => guess("higher")}
                  className="rounded-full border-2 border-white bg-white/10 px-6 py-2 font-bold backdrop-blur transition hover:bg-emerald-400 hover:text-neutral-900 md:px-7 md:py-3 md:text-lg"
                >
                  ▲ Higher
                </button>
                <button
                  onClick={() => guess("lower")}
                  className="rounded-full border-2 border-white bg-white/10 px-6 py-2 font-bold backdrop-blur transition hover:bg-rose-400 hover:text-neutral-900 md:px-7 md:py-3 md:text-lg"
                >
                  ▼ Lower
                </button>
              </div>
              <VelhoTip
                left={left}
                right={right}
                used={tipUsed}
                open={tipOpen}
                onAsk={() => {
                  setTipUsed(true);
                  setTipOpen(true);
                }}
              />
            </div>
          )}
          {phase === "revealed" && (
            <button
              onClick={advance}
              className="rounded-full bg-white px-8 py-2 font-semibold text-neutral-900 hover:bg-white/90 md:py-3"
            >
              {mode === "endless" && !lastCorrect.current ? "See result" : "Next →"}
            </button>
          )}
        </CompanyPanel>
      </div>
    </div>
  );
}
