"use client";

import type { ReactNode } from "react";
import type { HiringCompany } from "@/types/company";
import { ROUTINE_WORK, redact, type Clue } from "@/lib/case/cases";
import { Icon } from "@/components/ui/Icon";

/** The quote with its routine-work words marked, like a highlighter pen on the job ad. */
function Highlighted({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(ROUTINE_WORK)) {
    const start = match.index ?? 0;
    parts.push(text.slice(last, start));
    parts.push(
      <mark key={start} className="rounded-[4px] bg-sky/35 px-0.5 text-ink">
        {match[0]}
      </mark>,
    );
    last = start + match[0].length;
  }
  parts.push(text.slice(last));
  return <>{parts}</>;
}

function Pin() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path d="M12 21s-6-5.3-6-11a6 6 0 0 1 12 0c0 5.7-6 11-6 11z" />
      <circle cx="12" cy="10" r="2" />
    </svg>
  );
}

function ClueTitle({ n, title, isNew }: { n: number; title: string; isNew: boolean }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="font-mono text-xs text-clay">{String(n).padStart(2, "0")}</span>
      <span className="eyebrow text-ink-3">{title}</span>
      {isNew && <span className="eyebrow ml-auto rounded-full bg-clay px-2 py-0.5 text-[10px] text-ivory">New</span>}
    </div>
  );
}

function ClueCard({ clue, company, n, isNew }: { clue: Clue; company: HiringCompany; n: number; isNew: boolean }) {
  const ring = isNew ? "ring-2 ring-clay/40" : "";

  if (clue.kind === "quote") {
    return (
      <article className={`card relative col-span-2 overflow-hidden p-5 md:p-6 ${ring} ${isNew ? "animate-rise" : ""}`}>
        <span className="pointer-events-none absolute -top-4 right-4 font-serif text-[120px] leading-none text-sand-2" aria-hidden>
          ”
        </span>
        <ClueTitle n={n} title={clue.title} isNew={isNew} />
        <blockquote className="relative text-lg leading-relaxed md:text-[21px]">
          <Highlighted text={redact(clue.ad.quote, company)} />
        </blockquote>
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-sand px-3 py-1 text-xs text-ink-2">
          Job ad · <span className="font-medium text-ink">{redact(clue.ad.title, company)}</span>
        </p>
      </article>
    );
  }

  if (clue.kind === "map") {
    return (
      <article className={`card col-span-2 p-5 md:col-span-1 ${ring} ${isNew ? "animate-rise" : ""}`}>
        <ClueTitle n={n} title={clue.title} isNew={isNew} />
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-[12px] bg-navy text-ivory">
            <span className="text-2xl font-semibold leading-none">{clue.openRoles}</span>
            <span className="eyebrow mt-1 text-[9px] text-on-dark-2">open</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(clue.cities.length ? clue.cities : ["Finland"]).map((city) => (
              <span key={city} className="inline-flex items-center gap-1 rounded-full border border-sand-2 bg-white px-2.5 py-1 text-sm">
                <Pin /> {city}
              </span>
            ))}
          </div>
        </div>
      </article>
    );
  }

  if (clue.kind === "chips") {
    return (
      <article className={`card col-span-2 p-5 md:col-span-1 ${ring} ${isNew ? "animate-rise" : ""}`}>
        <ClueTitle n={n} title={clue.title} isNew={isNew} />
        <div className="flex flex-wrap gap-1.5">
          {clue.items.map((item) => (
            <span key={item} className="rounded-full bg-sage/20 px-3 py-1.5 text-sm font-medium text-sage-d">
              {item}
            </span>
          ))}
        </div>
      </article>
    );
  }

  return (
    <article className={`col-span-2 rounded-[14px] bg-navy p-5 text-ivory md:col-span-1 ${ring} ${isNew ? "animate-rise" : ""}`}>
      <div className="mb-3 flex items-center gap-2">
        <span className="font-mono text-xs text-sky">{String(n).padStart(2, "0")}</span>
        <span className="eyebrow text-on-dark-2">{clue.title}</span>
        {isNew && <span className="eyebrow ml-auto rounded-full bg-sky px-2 py-0.5 text-[10px] text-navy">New</span>}
      </div>
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky text-sm font-bold text-navy">V</span>
        <p className="rounded-[12px] rounded-tl-none bg-ivory/10 px-3.5 py-2.5 text-[15px] leading-snug">{clue.note}</p>
      </div>
    </article>
  );
}

function LockedCard({ clue, n, onUnlock }: { clue: Clue; n: number; onUnlock?: () => void }) {
  const wide = clue.kind === "quote";
  return (
    <div
      className={`flex items-center gap-3 rounded-[14px] border border-dashed border-sand-2 bg-sand/60 px-5 py-4 ${
        wide ? "col-span-2" : "col-span-2 md:col-span-1"
      }`}
    >
      <span className="font-mono text-xs text-ink-3/60">{String(n).padStart(2, "0")}</span>
      <Icon name="lock" className="h-4 w-4 text-ink-3" />
      <span className="text-sm font-medium text-ink-2">{clue.title}</span>
      {onUnlock && (
        <button onClick={onUnlock} className="btn btn-line btn-sm ml-auto">
          <Icon name="spark" /> Unlock free
        </button>
      )}
    </div>
  );
}

type Props = {
  clues: Clue[];
  revealed: number;
  company: HiringCompany;
  /** Set while the free clue is still available. */
  onUnlock?: () => void;
};

/** The case file: unlocked clues as cards, newest marked, and the locked ones teased below. */
export function Evidence({ clues, revealed, company, onUnlock }: Props) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <p className="eyebrow text-sage-d">The evidence</p>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-ink-3">
            Clue {revealed} of {clues.length}
          </span>
          <div className="flex gap-1">
            {clues.map((_, i) => (
              <span key={i} className={`h-1.5 w-4 rounded-full ${i < revealed ? "bg-clay" : "bg-sand-2"}`} />
            ))}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {clues.slice(0, revealed).map((clue, i) => (
          <ClueCard key={i} clue={clue} company={company} n={i + 1} isNew={revealed > 1 && i === revealed - 1} />
        ))}
        {clues.slice(revealed).map((clue, i) => (
          <LockedCard key={`locked-${i}`} clue={clue} n={revealed + i + 1} onUnlock={i === 0 ? onUnlock : undefined} />
        ))}
      </div>
    </section>
  );
}
