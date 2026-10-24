"use client";

import { useState } from "react";
import type { HiringCompany } from "@/types/company";
import { MAX_GUESSES, caseShareText, type Feedback } from "@/lib/case/cases";
import { VELHO_URL } from "@/lib/velho";
import { CompanyLogo } from "@/components/game/CompanyLogo";
import { LeadForm } from "@/components/leads/LeadForm";
import { Icon } from "@/components/ui/Icon";

type Props = {
  company: HiringCompany;
  /** "Case No. 3" or "Practice case". */
  label: string;
  feedback: Feedback[];
  solved: boolean;
  fixChoice: number | null;
  onFixChoice: (index: number) => void;
  onPlayAnother: () => void;
  /** Set while playing a practice case. */
  onBackToDaily?: () => void;
  onPlayHigherLower: () => void;
};

/** Velho's take in one card: pick the first fix, then see Velho's call. */
function ThinkLikeVelho({ company, choice, onChoice }: { company: HiringCompany; choice: number | null; onChoice: (i: number) => void }) {
  const take = company.velhoCase!;
  const answered = choice !== null;
  return (
    <section className="card p-6 md:p-8">
      <p className="eyebrow text-sage-d">Think like Velho</p>
      <h2 className="mt-3 text-[clamp(24px,2.6vw,32px)]">What should they automate first?</h2>
      <div className="mt-5 grid gap-2">
        {take.fixOptions.map((option, i) => {
          const isRight = i === take.correctIndex;
          const state = !answered
            ? "border-sand-2 hover:border-navy-3"
            : isRight
              ? "border-sage-d bg-sage/15"
              : choice === i
                ? "border-clay/60 bg-clay/10"
                : "border-sand-2 opacity-45";
          return (
            <button
              key={option}
              disabled={answered}
              onClick={() => onChoice(i)}
              className={`flex items-center justify-between gap-3 rounded-[9px] border bg-white px-4 py-3.5 text-left font-medium transition ${state}`}
            >
              {option}
              {answered && isRight && <Icon name="check" className="h-4 w-4 shrink-0 text-sage-d" />}
              {answered && !isRight && choice === i && <Icon name="cross" className="h-4 w-4 shrink-0 text-clay" />}
            </button>
          );
        })}
      </div>
      {answered && (
        <div className="animate-rise mt-5 space-y-2 border-t border-sand-2 pt-5 text-[15.5px]">
          <p>
            <strong>{choice === take.correctIndex ? "Same call as Velho." : "Velho would start elsewhere."}</strong>{" "}
            <span className="text-ink-2">{take.fixReasoning}</span>
          </p>
          <p className="text-ink-2">
            <span className="eyebrow mr-2 text-sage-d">Making it stick</span>
            {take.adoptNote}
          </p>
        </div>
      )}
    </section>
  );
}

export function CaseReveal({
  company,
  label,
  feedback,
  solved,
  fixChoice,
  onFixChoice,
  onPlayAnother,
  onBackToDaily,
  onPlayHigherLower,
}: Props) {
  const [copied, setCopied] = useState(false);
  const ads = company.jobAds!;
  const take = company.velhoCase;
  const fixedRight = take && fixChoice !== null ? fixChoice === take.correctIndex : null;

  const share = async () => {
    const text = caseShareText({ label, feedback, solved, fixedRight, url: window.location.origin });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      window.prompt("Copy your result:", text);
    }
  };

  return (
    <div>
      {/* The answer, on the company's photo with Velho's navy shade */}
      <section className="relative isolate overflow-hidden bg-navy text-center text-ivory">
        {company.image && (
          // eslint-disable-next-line @next/next/no-img-element -- full-bleed background photo
          <img src={company.image} alt="" aria-hidden className="absolute inset-0 -z-20 h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(0deg,rgb(10_27_52/0.96)_0%,rgb(10_27_52/0.82)_60%,rgb(10_27_52/0.7)_100%)]" />
        <div className="animate-rise mx-auto max-w-[760px] px-4 py-12 md:py-16">
          <p className="eyebrow text-sky">
            {label} · {solved ? `Solved in ${feedback.length} of ${MAX_GUESSES}` : "The answer was"}
          </p>
          <div className="mt-6 flex justify-center">
            <CompanyLogo company={company} className="h-20 w-20" />
          </div>
          <h1 className="mt-5 text-[clamp(40px,6vw,72px)] leading-none tracking-[-0.045em]">{company.name}</h1>
          <p className="mx-auto mt-5 max-w-md text-lg text-on-dark">
            <span className="font-semibold text-sky">
              {ads.manual} of {ads.checked}
            </span>{" "}
            of their open job ads describe work software could take over.
          </p>
          <a href={VELHO_URL} target="_blank" rel="noreferrer" className="btn btn-light mt-8">
            See how Velho fixes this <Icon name="arrowRight" />
          </a>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <button onClick={onPlayAnother} className="btn btn-line-dark">
              Play another case
            </button>
            <button onClick={share} className="btn btn-line-dark">
              {copied ? "Copied" : "Share result"}
            </button>
          </div>
        </div>
        {company.imageCredit && (
          <a
            href={company.imageCredit.url}
            target="_blank"
            rel="noreferrer"
            className="absolute bottom-2 right-3 text-[10px] text-on-dark-2 hover:text-ivory"
          >
            Photo: {company.imageCredit.author} / {company.imageCredit.source}
          </a>
        )}
      </section>

      <main className="mx-auto flex max-w-[760px] flex-col gap-8 px-4 py-10 md:py-14">
        {/* The way to Velho, framed by the case itself */}
        <section className="rounded-[14px] bg-navy p-7 text-ivory md:p-9">
          <p className="eyebrow text-sky">Your company</p>
          <h2 className="mt-3 text-[clamp(26px,3vw,38px)] tracking-[-0.03em]">
            Want this analysis for your company?
          </h2>
          <p className="mt-3 max-w-lg text-on-dark">
            Velho reads your open job ads, sends a one-page note like{" "}
            <a href={`/brief/${company.id}`} target="_blank" className="text-sky underline underline-offset-4">
              this one for {company.name}
            </a>
            , and suggests 30 minutes to find the first opportunity.
          </p>
          <div className="mt-6">
            <LeadForm source="case-reveal" contextCompanyId={company.id} />
          </div>
          <a
            href={VELHO_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex items-center gap-1.5 text-sm text-on-dark hover:text-ivory"
          >
            Or go to velho.io <Icon name="arrowRight" className="h-3.5 w-3.5" />
          </a>
        </section>

        {take && <ThinkLikeVelho company={company} choice={fixChoice} onChoice={onFixChoice} />}

        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
          {onBackToDaily && (
            <button onClick={onBackToDaily} className="text-navy-3 hover:text-ink">
              Back to today&apos;s case
            </button>
          )}
          <button onClick={onPlayHigherLower} className="text-navy-3 hover:text-ink">
            Play higher or lower
          </button>
        </div>

        <p className="text-center text-xs text-ink-3">
          {ads.source}, read {ads.fetchedAt}.
        </p>
      </main>
    </div>
  );
}
