"use client";

import type { HiringCompany } from "@/types/company";
import { redact, type Clue } from "@/lib/case/cases";
import { Icon } from "@/components/ui/Icon";

/** What each kind of clue is, said plainly above it. */
const KIND_LABEL: Record<Clue["kind"], string> = {
  quote: "From a job ad",
  map: "Hiring map",
  chips: "What they hire for",
  analyst: "Velho analyst",
  fact: "Fact",
};

function label(clue: Clue): string {
  if (clue.kind === "fact") return clue.title;
  return clue.kind === "chips" && clue.title !== "What they hire for" ? clue.title : KIND_LABEL[clue.kind];
}

/** The clue's content as one plain line or quote. */
function ClueBody({ clue, company }: { clue: Clue; company: HiringCompany }) {
  switch (clue.kind) {
    case "quote":
      return (
        <figure>
          <blockquote className="text-lg leading-snug tracking-[-0.01em] md:text-xl">
            “{redact(clue.ad.quote, company)}”
          </blockquote>
          <figcaption className="mt-2 text-sm text-ink-3">{redact(clue.ad.title, company)}</figcaption>
        </figure>
      );
    case "map":
      return (
        <p className="text-lg">
          <strong className="font-semibold">
            {clue.openRoles} open {clue.openRoles === 1 ? "role" : "roles"}
          </strong>
          <span className="text-ink-2"> in {clue.cities.join(", ") || "Finland"}</span>
        </p>
      );
    case "chips":
      return <p className="text-lg">{clue.items.join(" · ")}</p>;
    case "analyst":
      return <p className="text-lg leading-snug">{clue.note}</p>;
    case "fact":
      return <p className="text-lg leading-snug">{clue.text}</p>;
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
                {label(clue)}
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
          Next clue: <span className="text-ink-2">{label(next)}</span>
        </p>
      )}
    </section>
  );
}
