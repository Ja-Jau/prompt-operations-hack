"use client";

import { Icon, type IconName } from "@/components/ui/Icon";

const STEPS: { icon: IconName; text: string }[] = [
  { icon: "quote", text: "Read real quotes from a company's job ads." },
  { icon: "target", text: "Pick the company from six cards." },
  { icon: "spark", text: "Each miss unlocks a clue and a hint about the answer." },
];

/** A static picture of the cards after two misses, so the hints make sense before the first pick. */
function ExampleCards() {
  const cards = [
    { name: "Company A", hint: "Different cities and roles", out: true },
    { name: "Company B", hint: "Answer also hires in Tampere", out: true },
    { name: "Company C", hint: "", out: false },
  ];
  return (
    <div className="grid grid-cols-3 gap-2" aria-hidden>
      {cards.map((c) => (
        <div key={c.name} className={`rounded-[9px] border border-sand-2 p-2.5 ${c.out ? "bg-sand" : "bg-white"}`}>
          <p className={`text-sm font-semibold ${c.out ? "text-ink-3 line-through" : ""}`}>{c.name}</p>
          {c.hint && <p className="mt-2 text-[10px] leading-tight text-ink-2">{c.hint}</p>}
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
          <ExampleCards />
        </div>

        <button onClick={onClose} className="btn btn-dark mt-7 w-full">
          Start <Icon name="arrowRight" />
        </button>
      </div>
    </div>
  );
}
