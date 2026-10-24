"use client";

import { Icon, type IconName } from "@/components/ui/Icon";

type Props = {
  scanned: number;
  found: number;
  shortlisted: number;
  contacts: number;
  drafted: number;
  selected: number;
};

/** The four stages of the desk, each with its count, so the audience sees the funnel at a glance. */
export function PipelineSteps({ scanned, found, shortlisted, contacts, drafted, selected }: Props) {
  const steps: { icon: IconName; title: string; value: string; detail: string }[] = [
    {
      icon: "search",
      title: "Find targets",
      value: String(found),
      detail: `of ${scanned} hiring companies have ads describing routine work`,
    },
    {
      icon: "target",
      title: "Compile",
      value: String(shortlisted),
      detail: "shortlisted with quotes, locations, functions and Velho's first fix",
    },
    {
      icon: "quote",
      title: "Resolve contacts",
      value: String(contacts),
      detail: "candidate inboxes plus the decision-maker role to look up, each with a confidence",
    },
    {
      icon: "spark",
      title: "Draft & send",
      value: `${selected}/${drafted}`,
      detail: "proposals drafted and selected for the demo batch",
    },
  ];

  return (
    <ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {steps.map((s, i) => (
        <li key={s.title} className="card relative p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sand text-navy">
              <Icon name={s.icon} className="h-4 w-4" />
            </span>
            <div>
              <p className="eyebrow text-[10px] text-ink-3">Step {i + 1}</p>
              <p className="font-semibold">{s.title}</p>
            </div>
          </div>
          <p className="mt-4 text-4xl font-semibold tracking-[-0.03em]">{s.value}</p>
          <p className="mt-1.5 text-sm leading-snug text-ink-2">{s.detail}</p>
          {i < steps.length - 1 && (
            <Icon name="arrowRight" className="absolute -right-3 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-sand-2 lg:block" />
          )}
        </li>
      ))}
    </ol>
  );
}
