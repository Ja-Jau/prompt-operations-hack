"use client";

import type { EmailDraft } from "@/lib/outreach/email";
import { emailAsText } from "@/lib/outreach/email";
import { CopyButton } from "@/components/ui/CopyButton";
import { Icon } from "@/components/ui/Icon";
import { ContactSheetView } from "./ContactSheetView";
import type { Prospect } from "./types";

type Props = {
  prospect: Prospect;
  draft: EmailDraft;
  onDraftChange: (patch: Partial<EmailDraft>) => void;
};

const inputClass =
  "w-full rounded-[9px] border border-sand-2 bg-white px-3 py-2 font-mono text-sm outline-none transition focus:border-navy-3";

/** The middle steps for one company, side by side: why, the evidence, who, and the email to review. */
export function ProspectDetail({ prospect, draft, onDraftChange }: Props) {
  const { reasons, ads, locations, functions, firstFix, serviceArea, isCase, sheet, briefPath, company } = prospect;

  return (
    <div className="animate-rise grid gap-6 border-t border-sand-2 bg-cream/60 p-4 md:grid-cols-[1fr_1.2fr] md:p-6">
      <div className="flex flex-col gap-6">
        <section>
          <p className="eyebrow text-sage-d">Why this company</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {reasons.map((r) => (
              <li key={r} className="flex gap-2">
                <Icon name="check" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sage-d" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-3">
            {functions.join(" · ") || "No function data"} · {locations.slice(0, 4).join(", ") || "Finland"}
            {locations.length > 4 && ` +${locations.length - 4}`}
          </p>
        </section>

        <section>
          <p className="eyebrow text-sage-d">In their own words</p>
          <ol className="mt-2 space-y-3">
            {ads.slice(0, 2).map((ad) => (
              <li key={ad.url + ad.quote} className="text-sm">
                <p className="leading-snug">“{ad.quote}”</p>
                <a href={ad.url} target="_blank" rel="noreferrer" className="eyebrow mt-1 inline-block text-[10px] text-ink-3 hover:text-ink">
                  {ad.title} ↗
                </a>
              </li>
            ))}
          </ol>
          {firstFix && (
            <p className="mt-3 text-sm text-ink-2">
              <span className="eyebrow mr-2 text-sage-d">Start with</span>
              {firstFix}
              {serviceArea && <span className="ml-2 rounded-full bg-sand px-2 py-0.5 text-xs">{serviceArea}</span>}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <a href={briefPath} target="_blank" className="btn btn-line btn-sm">
              Open brief <Icon name="arrowRight" className="h-3.5 w-3.5" />
            </a>
            {isCase && <span className="text-xs text-ink-3">Also a Who&apos;s hiring? case</span>}
          </div>
        </section>

        <ContactSheetView sheet={sheet} current={draft.to} onPick={(to) => onDraftChange({ to })} />
      </div>

      <section className="flex flex-col">
        <div className="flex items-center justify-between">
          <p className="eyebrow text-sage-d">Proposal email · draft</p>
          <CopyButton text={emailAsText(draft)} label="Copy email" />
        </div>
        <label className="mt-3 block text-xs text-ink-3">
          To
          <input
            className={`${inputClass} mt-1`}
            value={draft.to}
            onChange={(e) => onDraftChange({ to: e.target.value })}
            aria-label={`Recipient for ${company.name}`}
          />
        </label>
        <label className="mt-2 block text-xs text-ink-3">
          Subject
          <input
            className={`${inputClass} mt-1`}
            value={draft.subject}
            onChange={(e) => onDraftChange({ subject: e.target.value })}
            aria-label={`Subject for ${company.name}`}
          />
        </label>
        <button type="button" onClick={() => onDraftChange({ subject: draft.subjectFi })} className="mt-1 self-start text-left text-xs text-navy-3 hover:text-ink">
          Use Finnish subject: <span className="italic">{draft.subjectFi}</span>
        </button>
        <textarea
          className={`${inputClass} mt-2 min-h-[380px] flex-1 resize-y font-sans leading-relaxed`}
          value={draft.body}
          onChange={(e) => onDraftChange({ body: e.target.value })}
          aria-label={`Email body for ${company.name}`}
        />
        <p className="mt-2 text-xs text-ink-3">
          Edits stay in this page. Quotes are verbatim from the ad; the rest is a draft for a person at Velho to approve.
        </p>
      </section>
    </div>
  );
}
