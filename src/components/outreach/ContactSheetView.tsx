"use client";

import { CONFIDENCE_LABEL, type ContactSheet, type Confidence } from "@/lib/outreach/contacts";

export const CONFIDENCE_CLASS: Record<Confidence, string> = {
  verified: "bg-sage/20 text-sage-d",
  likely: "bg-sky/20 text-navy",
  derived: "bg-clay/10 text-clay",
};

export function ConfidenceBadge({ level }: { level: Confidence }) {
  return (
    <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${CONFIDENCE_CLASS[level]}`}>
      {CONFIDENCE_LABEL[level]}
    </span>
  );
}

type Props = {
  sheet: ContactSheet;
  /** The address currently in the draft's To field. */
  current: string;
  onPick: (email: string) => void;
};

/** Step 3 for one company: the domain, candidate inboxes, and the decision-maker to look up. */
export function ContactSheetView({ sheet, current, onPick }: Props) {
  const link = "text-navy-3 underline underline-offset-4 hover:text-ink";
  return (
    <section>
      <p className="eyebrow text-sage-d">Who to write to</p>
      <p className="mt-2 flex items-center gap-2 text-sm">
        <span className="font-mono">{sheet.domain}</span>
        <ConfidenceBadge level={sheet.domainConfidence} />
      </p>
      <ul className="mt-2 space-y-1.5">
        {sheet.contacts.map((c) => (
          <li key={c.email} className="flex flex-wrap items-center gap-2 text-sm">
            <button
              type="button"
              onClick={() => onPick(c.email)}
              title={c.basis}
              className={`rounded-[7px] border px-2 py-1 font-mono text-xs transition ${
                current === c.email ? "border-navy bg-navy text-ivory" : "border-sand-2 bg-white hover:border-navy-3"
              }`}
            >
              {c.email}
            </button>
            <span className="text-xs text-ink-2">{c.role}</span>
            <ConfidenceBadge level={c.confidence} />
          </li>
        ))}
      </ul>
      <div className="mt-3 rounded-[9px] border border-sand-2 bg-white p-3 text-sm">
        <p>
          <span className="eyebrow mr-2 text-sage-d">Ask for</span>
          <strong>{sheet.decisionMaker.title}</strong>
        </p>
        <p className="mt-1 text-ink-2">{sheet.decisionMaker.why}</p>
        <div className="mt-2 flex flex-wrap gap-3 text-xs">
          <a href={sheet.decisionMaker.linkedInSearch} target="_blank" rel="noreferrer" className={link}>
            Find on LinkedIn
          </a>
          <a href={sheet.contactPageSearch} target="_blank" rel="noreferrer" className={link}>
            Find contact page
          </a>
          <a href={sheet.website} target="_blank" rel="noreferrer" className={link}>
            {sheet.website.replace("https://", "")}
          </a>
        </div>
      </div>
      <p className="mt-2 text-xs text-ink-3">
        Addresses are role inboxes, never a guessed personal address. &quot;Derived&quot; means built from the company name:
        check before use.
      </p>
    </section>
  );
}
