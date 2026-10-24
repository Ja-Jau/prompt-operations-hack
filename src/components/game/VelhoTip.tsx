"use client";

import { useEffect, useRef } from "react";
import type { GameCompany as Company } from "@/types/company";
import { METRICS, type MetricId } from "@/lib/game/metrics";
import { Icon } from "@/components/ui/Icon";

type Props = {
  left: Company;
  right: Company;
  metric: MetricId;
  used: boolean;
  open: boolean;
  onAsk: () => void;
};

/** The once-per-game lifeline: Velho as the analyst with a clue. Styled for the navy panels. */
export function VelhoTip({ left, right, metric, used, open, onAsk }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  return (
    <>
      <button onClick={() => open ? dialog.current?.showModal() : onAsk()} disabled={used && !open} className="btn btn-line-dark btn-sm">
        <Icon name="spark" /> {open ? "View tip" : used ? "Tip used" : "Ask Velho (1 tip)"}
      </button>
      <dialog ref={dialog} aria-label="Velho tip" className="fixed inset-0 m-auto max-h-[80dvh] w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-2xl border border-line-dark bg-navy p-5 text-left text-ivory shadow-2xl backdrop:bg-black/60">
        <button autoFocus onClick={() => dialog.current?.close()} className="float-right rounded px-3 py-1 text-sky hover:bg-white/10">Close</button>
        <p className="eyebrow text-sky">Velho tip</p>
        <p className="mt-2 text-sm text-ivory">{METRICS[metric].explanation}</p>
        <p className="mt-2 text-sm text-ivory">
          <strong>{right.name}</strong>: {right.hint}
        </p>
        <p className="mt-1 text-sm text-on-dark-2">
          <strong>{left.name}</strong>: {left.hint}
        </p>
      </dialog>
    </>
  );
}
