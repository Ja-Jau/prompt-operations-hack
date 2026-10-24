"use client";

import { temperature, type Feedback } from "@/lib/case/cases";
import { Icon, type IconName } from "@/components/ui/Icon";

const TONE = {
  burning: { bar: "bg-clay/45", text: "text-clay" },
  hot: { bar: "bg-clay/30", text: "text-clay" },
  warm: { bar: "bg-sky/45", text: "text-navy-3" },
  cold: { bar: "bg-navy-3/20", text: "text-navy-3" },
  freezing: { bar: "bg-navy-3/10", text: "text-ink-3" },
};

/** A hint in words, naming exactly what the guess shares with the answer. */
function Chip({ match, icon, children }: { match: boolean; icon: IconName; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${
        match ? "border-sage/50 bg-sage/15 text-sage-d" : "border-sand-2 bg-sand text-ink-2"
      }`}
    >
      <Icon name={icon} className="h-3 w-3" />
      {children}
    </span>
  );
}

/**
 * One guess: a hot-or-cold bar with the company name and its rank (1 = the answer), and
 * underneath, hints that name what this company shares with the answer.
 */
export function GuessBar({ feedback, latest }: { feedback: Feedback; latest?: boolean }) {
  const { company, rank, correct, sharedCities, sharedRoles, openRoles, closeness } = feedback;
  const temp = temperature(closeness);
  const tone = correct ? { bar: "bg-sage/45", text: "text-sage-d" } : TONE[temp.tone];
  const width = Math.max(4, Math.round(closeness * 100));

  return (
    <div className={`relative ${latest ? "animate-rise" : ""}`}>
      {latest && <Icon name="play" className="absolute -left-6 top-[30px] h-3.5 w-3.5 -translate-y-1/2 text-ink" />}
      <div className={`overflow-hidden rounded-[9px] border bg-white ${latest ? "border-navy-3" : "border-sand-2"}`}>
        <div className="flex h-[60px] items-stretch">
          <div className="relative flex min-w-0 flex-1 items-center">
            <div className={`absolute inset-y-0 left-0 ${tone.bar} transition-[width] duration-700`} style={{ width: `${width}%` }} />
            <span className="relative ml-5 truncate text-lg font-semibold tracking-[-0.01em] md:text-xl">{company.name}</span>
            <span className={`eyebrow relative ml-auto shrink-0 pl-3 pr-4 ${tone.text}`}>{correct ? "Found it" : temp.label}</span>
          </div>
          <div className="flex w-[72px] shrink-0 items-center justify-center border-l border-sand-2 font-mono text-xl font-semibold tabular-nums">
            {correct ? <Icon name="check" className="h-6 w-6 text-sage-d" /> : rank}
          </div>
        </div>
        {!correct && (
          <div className="flex flex-wrap gap-1.5 border-t border-sand-2 px-4 py-2.5">
            <Chip match={sharedRoles.length > 0} icon={sharedRoles.length > 0 ? "check" : "cross"}>
              {sharedRoles.length > 0 ? `Also hires for ${sharedRoles.slice(0, 2).join(" & ")}` : "Hires for other roles"}
            </Chip>
            <Chip match={sharedCities.length > 0} icon={sharedCities.length > 0 ? "check" : "cross"}>
              {sharedCities.length > 0 ? `Also hiring in ${sharedCities.slice(0, 2).join(" & ")}` : "Not in the same cities"}
            </Chip>
            <Chip match={openRoles === "same"} icon={openRoles === "up" ? "arrowUp" : openRoles === "down" ? "arrowDown" : "check"}>
              {openRoles === "up"
                ? "The answer is hiring more"
                : openRoles === "down"
                  ? "The answer is hiring less"
                  : "Same number of openings"}
            </Chip>
          </div>
        )}
      </div>
    </div>
  );
}
