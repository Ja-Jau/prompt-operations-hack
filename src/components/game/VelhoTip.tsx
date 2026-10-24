"use client";

import type { Company } from "@/types/company";
import { Icon } from "@/components/ui/Icon";

type Props = {
  left: Company;
  right: Company;
  used: boolean;
  open: boolean;
  onAsk: () => void;
};

/** The once-per-game lifeline: Velho as the analyst with a clue. Styled for the navy panels. */
export function VelhoTip({ left, right, used, open, onAsk }: Props) {
  if (open) {
    return (
      <div className="animate-rise max-w-sm rounded-[14px] border border-line-dark bg-navy/80 p-4 text-left backdrop-blur-md">
        <p className="eyebrow text-sky">Velho tip</p>
        <p className="mt-2 text-sm text-ivory">
          <strong>{right.name}</strong>: {right.hint}
        </p>
        <p className="mt-1 text-sm text-on-dark-2">
          <strong>{left.name}</strong>: {left.hint}
        </p>
      </div>
    );
  }

  return (
    <button onClick={onAsk} disabled={used} className="btn btn-line-dark btn-sm">
      <Icon name="spark" />
      {used ? "Tip used" : "Ask Velho (1 tip)"}
    </button>
  );
}
