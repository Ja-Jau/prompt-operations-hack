"use client";

import type { ReactNode } from "react";
import { VELHO_URL } from "@/lib/velho";
import { Icon } from "@/components/ui/Icon";

export type GameId = "case" | "higherLower";

const GAMES: { id: GameId; label: string }[] = [
  { id: "case", label: "Who's hiring?" },
  { id: "higherLower", label: "Higher or lower" },
];

type Props = {
  game: GameId;
  onGameChange: (game: GameId) => void;
  /** Per-game status, e.g. guesses left or the streak. */
  status?: ReactNode;
  /** Per-game controls, e.g. the daily/endless switch. */
  controls?: ReactNode;
  /** Shows a round help button when set. */
  onHelp?: () => void;
};

/** Navy header shared by both games: wordmark, game links, status, help and the way to Velho. */
export function TopBar({ game, onGameChange, status, controls, onHelp }: Props) {
  return (
    <header className="sticky top-0 z-30 flex h-[60px] shrink-0 items-center gap-5 bg-navy px-4 text-ivory md:h-[72px] md:gap-8 md:px-8">
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-semibold tracking-tight md:text-[22px]">Tehokas</span>
        <span className="eyebrow hidden text-on-dark-2 lg:inline">by Velho</span>
      </div>

      <nav className="flex gap-4 md:gap-7">
        {GAMES.map((g) => (
          <button
            key={g.id}
            onClick={() => onGameChange(g.id)}
            className={`border-b py-1 text-[13px] transition md:text-[15px] ${
              game === g.id ? "border-sky text-ivory" : "border-transparent text-on-dark hover:text-ivory"
            }`}
          >
            {g.label}
          </button>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-3">
        {status && <div className="hidden font-mono text-xs text-on-dark md:block">{status}</div>}
        {controls}
        {onHelp && (
          <button
            onClick={onHelp}
            aria-label="How to play"
            title="How to play"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line-dark text-on-dark transition hover:border-on-dark-2 hover:text-ivory"
          >
            <Icon name="help" />
          </button>
        )}
        <a href={VELHO_URL} target="_blank" rel="noreferrer" className="btn btn-light btn-sm">
          <span className="hidden sm:inline">Go to</span> Velho <Icon name="arrowRight" className="h-3.5 w-3.5" />
        </a>
      </div>
    </header>
  );
}
