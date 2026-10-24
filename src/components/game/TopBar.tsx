"use client";

import type { Mode } from "@/types/company";
import { DAILY_ROUNDS, dailyNumber } from "@/lib/game/daily";

type Props = {
  mode: Mode;
  results: boolean[];
  /** True while a guess is open, so the next empty dot pulses. */
  awaitingGuess: boolean;
  unverifiedCount: number;
  onModeChange: (mode: Mode) => void;
};

function ProgressDots({ results, awaitingGuess }: { results: boolean[]; awaitingGuess: boolean }) {
  return (
    <div className="flex items-center gap-1.5" aria-label={`${results.length} of ${DAILY_ROUNDS} rounds played`}>
      {Array.from({ length: DAILY_ROUNDS }, (_, i) => {
        const result = results[i];
        const isCurrent = awaitingGuess && i === results.length;
        const color =
          result === true ? "bg-emerald-400" : result === false ? "bg-rose-500" : isCurrent ? "bg-white" : "bg-white/20";
        return (
          <span
            key={i}
            className={`h-2.5 w-2.5 rounded-full transition-colors md:h-3 md:w-3 ${color} ${isCurrent ? "animate-pulse" : ""}`}
          />
        );
      })}
    </div>
  );
}

/** Logo, round progress and mode switch in one bar. */
export function TopBar({ mode, results, awaitingGuess, unverifiedCount, onModeChange }: Props) {
  const streak = results.filter(Boolean).length;

  return (
    <header className="relative z-20 grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-white/10 bg-neutral-950/90 px-4 py-2.5 backdrop-blur">
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-black tracking-tight md:text-2xl">
          Tehokas<span className="text-amber-300">.</span>
        </span>
        <span className="hidden text-[10px] uppercase tracking-[0.2em] text-white/40 lg:inline">by Velho</span>
      </div>

      <div className="flex flex-col items-center gap-1">
        {mode === "daily" ? (
          <>
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">
              Daily #{dailyNumber()}
            </span>
            <ProgressDots results={results} awaitingGuess={awaitingGuess} />
          </>
        ) : (
          <span className="rounded-full bg-amber-300/15 px-3 py-1 text-sm font-bold text-amber-300">🔥 Streak {streak}</span>
        )}
      </div>

      <div className="flex items-center justify-end gap-2">
        {unverifiedCount > 0 && (
          <span
            title={`${unverifiedCount} companies use unverified seed figures`}
            className="hidden rounded-full border border-amber-300/40 px-2 py-0.5 text-[10px] uppercase tracking-wider text-amber-300/80 md:inline"
          >
            dev data
          </span>
        )}
        <div className="flex rounded-full bg-white/10 p-0.5 text-xs font-semibold md:text-sm">
          {(["daily", "endless"] as const).map((m) => (
            <button
              key={m}
              onClick={() => onModeChange(m)}
              className={`rounded-full px-3 py-1 capitalize transition ${
                mode === m ? "bg-white text-neutral-900" : "text-white/60 hover:text-white"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
