"use client";

import type { Company } from "@/types/company";

type Props = {
  left: Company;
  right: Company;
  used: boolean;
  open: boolean;
  onAsk: () => void;
};

/** The once-per-game lifeline: Velho as the consultant whispering a clue. */
export function VelhoTip({ left, right, used, open, onAsk }: Props) {
  if (open) {
    return (
      <div className="flex max-w-sm items-start gap-3 rounded-2xl border border-amber-300/30 bg-neutral-950/70 p-3 text-left shadow-xl backdrop-blur-md">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-300 text-sm font-black text-neutral-900">
          V
        </span>
        <div className="min-w-0 text-xs leading-snug md:text-sm">
          <p className="font-semibold text-amber-300">Velho tip</p>
          <p className="text-white/90">
            <strong>{right.name}</strong>: {right.hint}
          </p>
          <p className="mt-0.5 text-white/60">
            <strong>{left.name}</strong>: {left.hint}
          </p>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={onAsk}
      disabled={used}
      className="inline-flex items-center gap-2 rounded-full border border-amber-300/50 bg-neutral-950/60 px-4 py-1.5 text-xs font-semibold text-amber-300 backdrop-blur transition hover:bg-amber-300 hover:text-neutral-900 disabled:cursor-default disabled:border-white/10 disabled:text-white/30 disabled:hover:bg-neutral-950/60 md:text-sm"
    >
      <span>⚡</span>
      {used ? "Tip used" : "Ask Velho · 1 tip"}
    </button>
  );
}
