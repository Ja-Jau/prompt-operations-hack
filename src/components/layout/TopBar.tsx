"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { VELHO_URL } from "@/lib/velho";
import { Icon } from "@/components/ui/Icon";

export type GameId = "case" | "higherLower" | "ceo";

const GAMES: { id: GameId; label: string }[] = [
  { id: "case", label: "Firmle" },
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

/** Public game navigation. CEO prototypes are retained privately in the codebase. */
export function TopBar({ game, onGameChange, status, controls, onHelp }: Props) {
  return (
    <header className="sticky top-0 z-30 flex min-h-[60px] shrink-0 flex-wrap items-center gap-x-4 gap-y-1 bg-navy px-3 py-2 text-ivory sm:px-4 lg:h-[72px] lg:flex-nowrap lg:gap-4 lg:px-6 lg:py-0 xl:gap-6">
      <div className="flex items-baseline gap-2.5">
        <Link
          href="/"
          onNavigate={() => onGameChange("case")}
          aria-label="Firmle home"
          className="rounded-sm text-[22px] font-extrabold tracking-[-0.04em] transition hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky md:text-[24px]"
        >
          Firm<span className="text-sky">le</span>
        </Link>
      </div>

      <nav aria-label="Games" className="order-last flex w-full min-w-0 items-center gap-1 overflow-x-auto lg:order-none lg:w-auto">
        {GAMES.map((g) => (
          <button
            key={g.id}
            onClick={() => onGameChange(g.id)}
            aria-current={game === g.id ? "page" : undefined}
            className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-medium tracking-[-0.01em] transition lg:text-[14px] ${
              game === g.id ? "bg-ivory/12 text-ivory" : "text-on-dark-2 hover:bg-ivory/6 hover:text-ivory"
            }`}
          >
            {g.label}
          </button>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-3">
        {status && <div className="hidden whitespace-nowrap text-[13px] font-medium tabular-nums text-on-dark xl:block">{status}</div>}
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
