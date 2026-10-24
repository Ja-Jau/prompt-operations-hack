"use client";

import type { HiringCompany } from "@/types/company";
import { redact, type Clue } from "@/lib/case/cases";
import { Icon } from "@/components/ui/Icon";

function ClueRow({ clue, company, n, newest }: { clue: Clue; company: HiringCompany; n: number; newest: boolean }) {
  return (
    <li className={`grid grid-cols-[40px_1fr] border-t border-sand-2 py-4 first:border-t-0 ${newest ? "animate-rise" : ""}`}>
      <span className="pt-1 font-mono text-[13px] text-clay">{String(n).padStart(2, "0")}</span>
      {clue.kind === "quote" ? (
        <figure>
          <blockquote className="text-lg leading-snug tracking-[-0.01em] md:text-xl">“{redact(clue.ad.quote, company)}”</blockquote>
          <figcaption className="eyebrow mt-2 text-ink-3">Job ad · {redact(clue.ad.title, company)}</figcaption>
        </figure>
      ) : (
        <p className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <span className="eyebrow text-ink-3">{clue.label}</span>
          <span className="text-right text-lg font-semibold">{clue.value}</span>
        </p>
      )}
    </li>
  );
}

/** The clues unlocked so far, newest last, with a note on how many are still locked. */
export function Evidence({ clues, revealed, company }: { clues: Clue[]; revealed: number; company: HiringCompany }) {
  const locked = clues.length - revealed;
  return (
    <section className="card px-5 py-2 md:px-6">
      <ol>
        {clues.slice(0, revealed).map((clue, i) => (
          <ClueRow key={i} clue={clue} company={company} n={i + 1} newest={i === revealed - 1} />
        ))}
      </ol>
      {locked > 0 && (
        <p className="flex items-center gap-2 border-t border-sand-2 py-3 text-sm text-ink-3">
          <Icon name="lock" className="h-3.5 w-3.5" />
          {locked} more {locked === 1 ? "clue unlocks" : "clues unlock"}, one per wrong guess
        </p>
      )}
    </section>
  );
}
