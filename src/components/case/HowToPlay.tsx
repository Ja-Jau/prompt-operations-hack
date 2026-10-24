"use client";

import { MAX_GUESSES } from "@/lib/case/cases";
import { Icon, type IconName } from "@/components/ui/Icon";

const STEPS: { icon: IconName; text: string }[] = [
  { icon: "quote", text: "Read real quotes from a company's job ads." },
  { icon: "search", text: `Guess who's hiring. ${MAX_GUESSES} tries, a new clue after each miss.` },
  { icon: "target", text: "Each guess runs hot or cold. 1 is the answer." },
];

/** A static picture of two guesses, so the bars make sense before the first guess. */
function ExampleBars() {
  const bars = [
    { name: "Hot guess", rank: 2, width: "92%", color: "bg-clay/30", temp: "Hot" },
    { name: "Cold guess", rank: 84, width: "30%", color: "bg-navy-3/20", temp: "Cold" },
  ];
  return (
    <div className="space-y-2" aria-hidden>
      {bars.map((b) => (
        <div key={b.name} className="relative flex h-11 items-center overflow-hidden rounded-[9px] border border-sand-2 bg-white">
          <div className={`absolute inset-y-0 left-0 ${b.color}`} style={{ width: b.width }} />
          <span className="relative ml-4 flex-1 font-semibold">{b.name}</span>
          <span className="eyebrow relative mr-3 text-ink-3">{b.temp}</span>
          <span className="relative mr-4 font-mono font-semibold">{b.rank}</span>
        </div>
      ))}
    </div>
  );
}

/** The rules in three lines and a picture. */
export function HowToPlay({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 px-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal
      aria-labelledby="how-to-play"
    >
      <div className="card animate-rise relative w-full max-w-md p-7" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} aria-label="Close" className="absolute right-5 top-5 text-ink-3 hover:text-ink">
          <Icon name="cross" />
        </button>
        <p className="eyebrow text-sage-d">How to play</p>
        <h2 id="how-to-play" className="mt-2 text-[28px] tracking-[-0.03em]">
          Who&apos;s hiring for this?
        </h2>

        <ul className="mt-6 space-y-3">
          {STEPS.map((s) => (
            <li key={s.icon} className="flex items-center gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sand text-navy">
                <Icon name={s.icon} className="h-[18px] w-[18px]" />
              </span>
              <span className="text-[16px] font-medium">{s.text}</span>
            </li>
          ))}
        </ul>

        <div className="mt-6">
          <ExampleBars />
        </div>

        <button onClick={onClose} className="btn btn-dark mt-7 w-full">
          Start <Icon name="arrowRight" />
        </button>
      </div>
    </div>
  );
}
