"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import type { Company } from "@/types/company";
import { CompanyLogo } from "@/components/game/CompanyLogo";
import { Icon } from "@/components/ui/Icon";

const MAX_SUGGESTIONS = 6;

/** Company search that only accepts companies in the game, so every guess can be scored. */
export function GuessInput({
  companies,
  exampleIds,
  excluded,
  counter,
  onGuess,
}: {
  companies: Company[];
  /** Made-up companies, tagged in the list so nobody mistakes them for real ones. */
  exampleIds: Set<string>;
  excluded: Set<string>;
  /** Shown at the right edge of the field, e.g. "2/6". */
  counter: string;
  onGuess: (company: Company) => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return companies
      .filter((c) => !excluded.has(c.id) && c.name.toLowerCase().includes(q))
      .sort((a, b) => Number(!a.name.toLowerCase().startsWith(q)) - Number(!b.name.toLowerCase().startsWith(q)))
      .slice(0, MAX_SUGGESTIONS);
  }, [companies, excluded, query]);

  const pick = (company: Company) => {
    onGuess(company);
    setQuery("");
    setActive(0);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && suggestions[active]) {
      e.preventDefault();
      pick(suggestions[active]);
    }
  };

  return (
    <div className="relative">
      <Icon name="search" className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-3" />
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
        placeholder="Type a company…"
        aria-label="Guess a company"
        className="h-[60px] w-full rounded-[9px] border border-sand-2 bg-white pl-14 pr-20 text-lg text-ink outline-none transition placeholder:text-ink-3 focus:border-navy-3"
      />
      <span className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 font-mono text-[15px] text-ink-3">
        {counter}
      </span>
      {suggestions.length > 0 && (
        <ul className="card absolute inset-x-0 top-full z-30 mt-2 overflow-hidden shadow-[0_18px_40px_-20px_rgb(10_27_52/0.35)]">
          {suggestions.map((c, i) => (
            <li key={c.id}>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(c)}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left ${i === active ? "bg-sand" : ""}`}
              >
                <CompanyLogo company={c} className="h-8 w-8 rounded-[7px] p-1" />
                <span className="flex-1 font-medium">{c.name}</span>
                {exampleIds.has(c.id) && (
                  <span className="eyebrow rounded-full border border-clay/40 px-2 py-0.5 text-[10px] text-clay">Example</span>
                )}
                <span className="text-xs text-ink-3">{c.industry}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
