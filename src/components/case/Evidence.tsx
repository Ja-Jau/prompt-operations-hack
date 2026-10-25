"use client";

import { useState } from "react";
import type { HiringCompany } from "@/types/company";
import { redact, type Clue } from "@/lib/case/cases";
import { Icon } from "@/components/ui/Icon";

/** The clue's content as one plain line or quote, in English. */
function ClueBody({ clue, company }: { clue: Clue; company: HiringCompany }) {
  switch (clue.kind) {
    case "quote": {
      // Shown in English and shortened; say so, since it's no longer word for word.
      const note = clue.ad.quoteEn === clue.ad.quote ? null : /[äöå]/i.test(clue.ad.quote) ? "Translated from Finnish and shortened" : "Shortened";
      return (
        <figure>
          <blockquote className="text-lg leading-snug tracking-[-0.01em] md:text-xl">
            “{redact(clue.ad.quoteEn, company)}”
          </blockquote>
          {note && <figcaption className="mt-2 text-sm text-ink-3">{note}</figcaption>}
        </figure>
      );
    }
    case "map":
      return (
        <p className="text-lg">
          <strong className="font-semibold">{clue.cities.join(", ") || "Finland"}</strong>
          <span className="text-ink-2">
            {" "}
            · {clue.openRoles} open {clue.openRoles === 1 ? "role" : "roles"}
          </span>
        </p>
      );
    case "chips":
      return <p className="text-lg">{clue.items.join(" · ")}</p>;
    case "analyst":
      return <p className="text-lg leading-snug">{clue.note}</p>;
    case "fact":
      return <p className="text-lg leading-snug">{clue.text}</p>;
    case "name":
      return (
        <div className="flex flex-wrap gap-x-4 gap-y-2" aria-label={`Starts with ${clue.first}`}>
          {clue.wordLengths.map((length, w) => (
            <div key={w} className="flex gap-1">
              {Array.from({ length }, (_, i) => {
                const letter = w === 0 && i === 0 ? clue.first : "";
                return (
                  <span
                    key={i}
                    className={`flex h-9 w-8 items-center justify-center rounded-[6px] border text-lg font-semibold md:h-10 md:w-9 ${
                      letter ? "border-navy bg-navy text-ivory" : "border-sand-2 bg-white"
                    }`}
                  >
                    {letter}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      );
  }
}

/**
 * One clue at a time, so the options stay in view. Tabs switch between the unlocked
 * clues; a newly unlocked clue opens by itself. The next locked one is teased at the bottom.
 */
export function Evidence({ clues, revealed, company }: { clues: Clue[]; revealed: number; company: HiringCompany }) {
  const [view, setView] = useState({ revealed, active: revealed - 1 });
  // A new clue was unlocked: jump to it (adjusting state while rendering, no effect needed).
  if (view.revealed !== revealed) setView({ revealed, active: revealed - 1 });
  const active = Math.min(view.active, revealed - 1);
  const clue = clues[active];
  const next = clues[revealed];
  return (
    <section className="card px-5 md:px-6">
      <div role="tablist" aria-label="Clues" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pt-4">
        {clues.map((c, i) => {
          const unlocked = i < revealed;
          const selected = i === active;
          return (
            <button
              key={i}
              role="tab"
              aria-selected={selected}
              disabled={!unlocked}
              onClick={() => setView({ revealed, active: i })}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-medium transition ${
                selected
                  ? "bg-navy text-ivory"
                  : unlocked
                    ? "border border-sand-2 bg-white text-ink-2 hover:border-navy-3 hover:text-ink"
                    : "border border-dashed border-sand-2 text-ink-3"
              }`}
            >
              {!unlocked && <Icon name="lock" className="h-3 w-3" />}
              {unlocked ? c.title : i + 1}
            </button>
          );
        })}
      </div>
      {clue && (
        <div key={active} role="tabpanel" className="animate-rise py-5">
          <ClueBody clue={clue} company={company} />
        </div>
      )}
      {next && (
        <p className="flex items-center gap-2 border-t border-sand-2 py-3.5 text-sm text-ink-3">
          <Icon name="lock" className="h-3.5 w-3.5" />
          Next clue: <span className="text-ink-2">{next.title}</span>
          {next.kind === "name" && <span>, on your last pick</span>}
        </p>
      )}
    </section>
  );
}
