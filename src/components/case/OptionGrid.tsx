"use client";

import type { HiringCompany } from "@/types/company";
import { shortName, type Feedback } from "@/lib/case/cases";
import { CompanyLogo } from "@/components/game/CompanyLogo";
import { Icon } from "@/components/ui/Icon";

/** The one most useful thing a wrong pick tells you about the answer. */
function bestHint(f: Feedback): string {
  if (f.sharedCities.length > 0) return `Answer also hires in ${f.sharedCities[0]}`;
  if (f.sharedRoles.length > 0) return `Answer also hires for ${f.sharedRoles[0]}`;
  if (f.openRoles === "up") return "Answer is hiring more";
  if (f.openRoles === "down") return "Answer is hiring less";
  return "Different cities and roles";
}

const BURST_COLORS = ["bg-sky", "bg-clay", "bg-sage", "bg-ivory", "bg-sky", "bg-clay"];
const BURST_PIECES = 14;

/** A short confetti burst in Velho's colours, played once when the answer is found. */
function Burst() {
  return (
    <span className="pointer-events-none absolute left-1/2 top-1/2" aria-hidden>
      {Array.from({ length: BURST_PIECES }, (_, i) => (
        <span
          key={i}
          className={`animate-burst absolute h-2 w-2 rounded-[2px] ${BURST_COLORS[i % BURST_COLORS.length]}`}
          style={{ ["--a" as string]: `${(360 / BURST_PIECES) * i}deg`, animationDelay: `${(i % 3) * 40}ms` }}
        />
      ))}
    </span>
  );
}

type Props = {
  options: HiringCompany[];
  /** Feedback for the options already picked, by company id. */
  picked: Map<string, Feedback>;
  disabled: boolean;
  onPick: (company: HiringCompany) => void;
};

/** The company cards, 3 × 3: pick the one hiring for the quotes above. */
export function OptionGrid({ options, picked, disabled, onPick }: Props) {
  return (
    <div className="grid grid-cols-3 gap-2 md:gap-3">
      {options.map((company) => {
        const f = picked.get(company.id);
        const state = !f
          ? "border-sand-2 bg-white hover:-translate-y-0.5 hover:border-navy-3 hover:shadow-[0_12px_30px_-18px_rgb(10_27_52/0.45)]"
          : f.correct
            ? "animate-pop z-10 border-navy bg-navy text-ivory shadow-[0_18px_40px_-14px_rgb(10_27_52/0.6)]"
            : "border-sand-2 bg-sand";
        return (
          <button
            key={company.id}
            disabled={disabled || Boolean(f)}
            onClick={() => onPick(company)}
            className={`relative flex min-h-[112px] flex-col items-start gap-2 rounded-[14px] border p-3 text-left transition md:min-h-[128px] md:gap-3 md:p-4 ${state}`}
          >
            <div className={f && !f.correct ? "opacity-40 grayscale" : ""}>
              <CompanyLogo company={company} className="h-9 w-9 md:h-11 md:w-11" />
            </div>
            <div className="min-w-0">
              <p className={`text-[15px] font-semibold leading-tight tracking-tight md:text-[17px] ${f && !f.correct ? "text-ink-3 line-through" : ""}`}>
                {shortName(company)}
              </p>
              {!f && <p className="mt-1 hidden truncate text-xs text-ink-3 sm:block">{company.functions.slice(0, 2).join(" · ")}</p>}
            </div>
            {f?.correct && (
              <>
                <Burst />
                <span className="eyebrow absolute right-3 top-3 hidden items-center gap-1 text-sky sm:flex">
                  <Icon name="check" className="h-3.5 w-3.5" /> Found it
                </span>
              </>
            )}
            {f && !f.correct && (
              <p className="animate-rise mt-auto text-xs leading-snug text-ink-2">{bestHint(f)}</p>
            )}
          </button>
        );
      })}
    </div>
  );
}
