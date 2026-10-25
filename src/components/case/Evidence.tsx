"use client";

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

/** The unlocked clues, each introduced by what it is, with the next one teased at the bottom. */
export function Evidence({ clues, revealed, company }: { clues: Clue[]; revealed: number; company: HiringCompany }) {
  const next = clues[revealed];
  return (
    <section className="card px-5 md:px-6">
      <ol>
        {clues.slice(0, revealed).map((clue, i) => {
          const isNew = revealed > 1 && i === revealed - 1;
          return (
            <li key={i} className={`border-t border-sand-2 py-5 first:border-t-0 ${isNew ? "animate-rise" : ""}`}>
              <p className="eyebrow mb-2 flex items-center gap-2 text-ink-3">
                {clue.title}
                {isNew && <span className="h-1.5 w-1.5 rounded-full bg-clay" aria-label="New clue" />}
              </p>
              <ClueBody clue={clue} company={company} />
            </li>
          );
        })}
      </ol>
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
