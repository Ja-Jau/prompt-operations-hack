"use client";

import type { HiringCompany } from "@/types/company";
import { redact, type Clue } from "@/lib/case/cases";
import { Icon } from "@/components/ui/Icon";

/** The name as Wordle-style tiles: each word's first letter shown, the rest blank. */
function NameTiles({ words }: { words: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2" aria-label={`A name with ${words.length} word(s)`}>
      {words.map((word, w) => (
        <div key={w} className="flex gap-1">
          {[...word].map((ch, i) =>
            /\p{L}|\p{N}/u.test(ch) ? (
              <span
                key={i}
                className={`flex h-9 w-7 items-center justify-center rounded-[6px] font-mono text-base font-semibold ${
                  i === 0 ? "bg-navy text-ivory" : "border border-sand-2 bg-sand"
                }`}
              >
                {i === 0 ? ch.toUpperCase() : ""}
              </span>
            ) : (
              <span key={i} className="flex h-9 items-center px-0.5 font-mono text-base text-ink-3">
                {ch}
              </span>
            ),
          )}
        </div>
      ))}
    </div>
  );
}

function ClueRow({ clue, company, n, newest }: { clue: Clue; company: HiringCompany; n: number; newest: boolean }) {
  return (
    <li className={`grid grid-cols-[40px_1fr] border-t border-sand-2 py-4 first:border-t-0 ${newest ? "animate-rise" : ""}`}>
      <span className="pt-0.5 font-mono text-[13px] text-clay">{String(n).padStart(2, "0")}</span>
      <div>
        <p className="eyebrow mb-2 text-ink-3">{clue.title}</p>
        {clue.kind === "quote" ? (
          <figure>
            <blockquote className="text-lg leading-snug tracking-[-0.01em] md:text-xl">“{redact(clue.ad.quote, company)}”</blockquote>
            <figcaption className="mt-2 text-sm text-ink-2">Job ad: {redact(clue.ad.title, company)}</figcaption>
          </figure>
        ) : clue.kind === "name" ? (
          <NameTiles words={clue.words} />
        ) : (
          <p className="text-lg font-semibold leading-snug">{clue.value}</p>
        )}
      </div>
    </li>
  );
}

/** The clues unlocked so far, newest last, with a note on how many are still locked. */
export function Evidence({ clues, revealed, company }: { clues: Clue[]; revealed: number; company: HiringCompany }) {
  const next = clues[revealed];
  return (
    <section className="card px-5 py-2 md:px-6">
      <ol>
        {clues.slice(0, revealed).map((clue, i) => (
          <ClueRow key={i} clue={clue} company={company} n={i + 1} newest={i === revealed - 1} />
        ))}
      </ol>
      {next && (
        <p className="flex items-center gap-2 border-t border-sand-2 py-3 text-sm text-ink-3">
          <Icon name="lock" className="h-3.5 w-3.5" />
          Next up: <span className="font-medium text-ink-2">{next.title}</span>
          <span className="ml-auto font-mono text-xs">
            {revealed}/{clues.length}
          </span>
        </p>
      )}
    </section>
  );
}
