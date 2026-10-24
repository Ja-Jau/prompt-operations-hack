"use client";

import type { Mode } from "@/types/company";
import { dailyNumber } from "@/lib/game/daily";

type Props = {
  mode: Mode;
  streak: number;
  best: number;
  /** Whether the once-per-game Velho save is still available. */
  saveAvailable: boolean;
  unverifiedCount: number;
  onModeChange: (mode: Mode) => void;
};

/** Logo, streak and mode switch in one bar. */
export function TopBar({ mode, streak, best, saveAvailable, unverifiedCount, onModeChange }: Props) {
  return (
    <header className="relative z-20 grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-white/10 bg-neutral-950/90 px-4 py-2.5 backdrop-blur">
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-black tracking-tight md:text-2xl">
          Tehokas<span className="text-amber-300">.</span>
        </span>
        <span className="hidden text-[10px] uppercase tracking-[0.2em] text-white/40 lg:inline">
          {mode === "daily" ? `Daily #${dailyNumber()}` : "Endless"} · by Velho
        </span>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span key={streak} className="animate-pop rounded-full bg-amber-300/15 px-3 py-1 font-bold text-amber-300">
          🔥 {streak}
        </span>
        <span className="hidden text-white/50 sm:inline">Best {best}</span>
        <span
          title={saveAvailable ? "Velho saves you from one wrong guess" : "Velho save used"}
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            saveAvailable ? "bg-white/10 text-white" : "bg-white/5 text-white/30 line-through"
          }`}
        >
          ⚡ save
        </span>
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
