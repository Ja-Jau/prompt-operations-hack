"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { VELHO_URL } from "@/lib/velho";
import { Icon } from "@/components/ui/Icon";

export type GameId = "case" | "higherLower" | "ceo";

const GAMES: { id: GameId; label: string }[] = [
  { id: "case", label: "Who's hiring?" },
  { id: "higherLower", label: "Higher or lower" },
  { id: "ceo", label: "POV: You are the CEO" },
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

/** Shared navigation for all three games, with a second row on smaller screens. */
export function TopBar({ game, onGameChange, status, controls, onHelp }: Props) {
  return (
    <header className="sticky top-0 z-30 flex min-h-[60px] shrink-0 flex-wrap items-center gap-x-4 gap-y-1 bg-navy px-3 py-2 text-ivory sm:px-4 lg:h-[72px] lg:flex-nowrap lg:gap-4 lg:px-6 lg:py-0 xl:gap-6">
      <div className="flex items-baseline gap-2">
        <Link
          href="/"
          onNavigate={() => onGameChange("case")}
          aria-label="Tehokas home"
          className="rounded-sm text-xl font-semibold tracking-tight transition hover:text-sky focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky md:text-[22px]"
        >
          Tehokas
        </Link>
        <span className="eyebrow hidden text-on-dark-2 xl:inline">by Velho</span>
      </div>

      <nav aria-label="Games" className="order-last flex w-full min-w-0 items-center gap-3 overflow-x-auto lg:order-none lg:w-auto lg:gap-4 xl:gap-5">
        {GAMES.map((g) => (
          <button
            key={g.id}
            onClick={() => onGameChange(g.id)}
            aria-current={game === g.id ? "page" : undefined}
            className={`shrink-0 whitespace-nowrap border-b py-1.5 text-[11px] transition sm:text-[13px] lg:text-[14px] ${
              game === g.id ? "border-sky text-ivory" : "border-transparent text-on-dark hover:text-ivory"
            }`}
          >
            {g.label}
          </button>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-3">
        {status && <div className="hidden whitespace-nowrap font-mono text-xs text-on-dark xl:block">{status}</div>}
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
