"use client";

import type { EmailDraft } from "@/lib/outreach/email";
import { TIER_LABEL, type Tier } from "@/lib/outreach/targets";
import { shortName } from "@/lib/case/cases";
import { CompanyLogo } from "@/components/game/CompanyLogo";
import { Icon } from "@/components/ui/Icon";
import { ConfidenceBadge } from "./ContactSheetView";
import { ProspectDetail } from "./ProspectDetail";
import type { Prospect, SendState } from "./types";

const TIER_CLASS: Record<Tier, string> = {
  hot: "bg-clay text-ivory",
  warm: "bg-sky/30 text-navy",
  watch: "bg-sand text-ink-2",
};

const STATE_UI: Record<SendState, { label: string; className: string } | null> = {
  idle: null,
  queued: { label: "Queued", className: "text-ink-3" },
  sending: { label: "Simulating…", className: "text-navy-3" },
  simulated: { label: "Simulated · not sent", className: "text-sage-d" },
  error: { label: "Failed", className: "text-clay" },
};

type Props = {
  index: number;
  prospect: Prospect;
  draft: EmailDraft;
  selected: boolean;
  state: SendState;
  /** True if an earlier demo batch already recorded this company. */
  alreadyLogged: boolean;
  open: boolean;
  onToggleOpen: () => void;
  onToggleSelect: () => void;
  onDraftChange: (patch: Partial<EmailDraft>) => void;
};

/** One company on the board: the summary line, and the full detail when opened. */
export function ProspectRow({ index, prospect, draft, selected, state, alreadyLogged, open, onToggleOpen, onToggleSelect, onDraftChange }: Props) {
  const { company, score, tier, staffing, firstFix, manual, checked, sheet } = prospect;
  const stateUi = STATE_UI[state];
  const primary = sheet.contacts[0];

  return (
    <li className={`card overflow-hidden transition ${open ? "shadow-[0_18px_40px_-24px_rgb(10_27_52/0.35)]" : ""}`} data-testid="prospect">
      <div className="flex items-center gap-3 p-3 md:gap-4 md:p-4">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          aria-label={`Include ${company.name} in the batch`}
          className="h-4 w-4 shrink-0 accent-[#0a1b34]"
        />
        <span className="hidden w-6 font-mono text-xs text-ink-3 sm:block">{String(index).padStart(2, "0")}</span>
        <CompanyLogo company={company} className="h-10 w-10" />

        <button onClick={onToggleOpen} className="min-w-0 flex-1 text-left" aria-expanded={open}>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate font-semibold">{shortName(company)}</span>
            <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${TIER_CLASS[tier]}`}>
              {TIER_LABEL[tier]} · {score}
            </span>
            {staffing && <span className="rounded-full bg-sand px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-2">Agency</span>}
            {alreadyLogged && state === "idle" && (
              <span className="rounded-full bg-sky/20 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-navy">In demo log</span>
            )}
          </div>
          <p className="mt-0.5 truncate text-sm text-ink-2">
            {manual} of {checked} open {checked === 1 ? "role" : "roles"} routine
            {firstFix && <span className="hidden sm:inline"> · start with: {firstFix}</span>}
          </p>
        </button>

        <div className="hidden min-w-0 max-w-[220px] flex-col items-end md:flex">
          {primary && (
            <>
              <span className="truncate font-mono text-xs text-ink">{draft.to}</span>
              <span className="mt-1">
                <ConfidenceBadge level={primary.confidence} />
              </span>
            </>
          )}
        </div>

        <div className="w-[120px] shrink-0 text-right font-mono text-xs">
          {stateUi ? (
            <span className={`inline-flex items-center gap-1.5 ${stateUi.className}`} data-testid="row-state">
              {state === "simulated" && <Icon name="check" className="h-3.5 w-3.5" />}
              {state === "sending" && <Icon name="spark" className="h-3.5 w-3.5 animate-spin" />}
              {stateUi.label}
            </span>
          ) : (
            <button onClick={onToggleOpen} className="text-navy-3 hover:text-ink" aria-label={open ? "Collapse" : "Expand"}>
              {open ? "Hide" : "Review"}
            </button>
          )}
        </div>
      </div>

      {open && <ProspectDetail prospect={prospect} draft={draft} onDraftChange={onDraftChange} />}
    </li>
  );
}
