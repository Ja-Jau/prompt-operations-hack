"use client";

import type { Direction, Feedback } from "@/lib/case/cases";
import { Icon, type IconName } from "@/components/ui/Icon";

/** Closer guesses get a longer, cooler bar; far ones a short clay stub. */
function barStyle(rank: number, poolSize: number) {
  const closeness = poolSize > 1 ? 1 - (rank - 1) / (poolSize - 1) : 1;
  const width = Math.max(4, Math.round(closeness * 100));
  const color = rank === 1 ? "bg-sage/45" : closeness >= 0.8 ? "bg-sky/55" : closeness >= 0.45 ? "bg-navy-3/25" : "bg-clay/30";
  return { width, color };
}

/** A hint in words, from the answer's point of view, so nobody has to decode an arrow. */
function Chip({ match, icon, children }: { match: boolean; icon?: IconName; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${
        match ? "border-sage/50 bg-sage/15 text-sage-d" : "border-sand-2 bg-sand text-ink-2"
      }`}
    >
      {icon && <Icon name={icon} className="h-3 w-3" />}
      {children}
    </span>
  );
}

function sizeHint(d: Direction) {
  if (d === "same") return { match: true, icon: "check" as const, text: "Similar size" };
  return { match: false, icon: d === "up" ? ("arrowUp" as const) : ("arrowDown" as const), text: d === "up" ? "Answer is bigger" : "Answer is smaller" };
}

function earningsHint(d: Direction) {
  if (d === "same") return { match: true, icon: "check" as const, text: "Similar € per employee" };
  return {
    match: false,
    icon: d === "up" ? ("arrowUp" as const) : ("arrowDown" as const),
    text: d === "up" ? "Answer earns more per employee" : "Answer earns less per employee",
  };
}

/**
 * One guess: a closeness bar with the company name and its rank (1 = the answer),
 * and underneath, plain-language hints about how the answer differs.
 */
export function GuessBar({ feedback, poolSize, latest }: { feedback: Feedback; poolSize: number; latest?: boolean }) {
  const { company, rank, correct, sameIndustry, employees, revenuePerEmployee } = feedback;
  const { width, color } = barStyle(rank, poolSize);
  const size = sizeHint(employees);
  const earnings = earningsHint(revenuePerEmployee);

  return (
    <div className={`relative ${latest ? "animate-rise" : ""}`}>
      {latest && <Icon name="play" className="absolute -left-6 top-[30px] h-3.5 w-3.5 -translate-y-1/2 text-ink" />}
      <div className={`overflow-hidden rounded-[9px] border bg-white ${latest ? "border-navy-3" : "border-sand-2"}`}>
        <div className="flex h-[60px] items-stretch">
          <div className="relative flex flex-1 items-center">
            <div className={`absolute inset-y-0 left-0 ${color} transition-[width] duration-700`} style={{ width: `${width}%` }} />
            <span className="relative ml-5 truncate text-lg font-semibold tracking-[-0.01em] md:text-xl">{company.name}</span>
          </div>
          <div className="flex w-[72px] shrink-0 items-center justify-center border-l border-sand-2 font-mono text-xl font-semibold tabular-nums">
            {correct ? <Icon name="check" className="h-6 w-6 text-sage-d" /> : rank}
          </div>
        </div>
        {!correct && (
          <div className="flex flex-wrap gap-1.5 border-t border-sand-2 px-4 py-2.5">
            <Chip match={sameIndustry} icon={sameIndustry ? "check" : "cross"}>
              {sameIndustry ? "Same industry" : "Different industry"}
            </Chip>
            <Chip match={size.match} icon={size.icon}>
              {size.text}
            </Chip>
            <Chip match={earnings.match} icon={earnings.icon}>
              {earnings.text}
            </Chip>
          </div>
        )}
      </div>
    </div>
  );
}
