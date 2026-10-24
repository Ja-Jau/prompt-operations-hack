"use client";

import type { ReactNode } from "react";
import type { Company } from "@/types/company";
import { METRICS, type MetricId } from "@/lib/game/metrics";
import { revenuePerHour } from "@/lib/game/rules";
import { CompanyLogo } from "./CompanyLogo";

type Props = {
  company: Company;
  /** The metric this round compares. */
  metric: MetricId;
  /** Whether this company's answer is shown. */
  revealed: boolean;
  /** Replaces the big number, e.g. a "?" or a rolling counter. */
  value?: ReactNode;
  /** Shown under the stats, e.g. the Higher/Lower buttons. */
  children?: ReactNode;
};

function RevealDetails({ company, metric }: { company: Company; metric: MetricId }) {
  if (metric === "manualAds" && company.jobAds) {
    const { ads, checked, manual } = company.jobAds;
    return (
      <div className="animate-rise mt-3 flex max-w-md flex-col items-center gap-3">
        <p className="text-sm text-on-dark">
          {manual} of {checked} open job ads read
        </p>
        {ads[0] && (
          <div className="hidden rounded-[14px] border border-line-dark bg-navy/60 px-4 py-3 text-left text-sm backdrop-blur md:block">
            <p className="line-clamp-2 text-ivory">“{ads[0].quote}”</p>
            <p className="eyebrow mt-1.5 text-sky">{ads[0].title}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="animate-rise mt-2 flex flex-col items-center">
      <p className="text-sm text-on-dark">
        About <strong className="text-ivory">€{Math.round(revenuePerHour(company))}</strong> per working hour
      </p>
      <div className="mt-3 hidden max-w-md md:block">
        <p className="line-clamp-2 text-[15px] text-on-dark">
          <span className="eyebrow mr-2 text-sky">Velho insight</span>
          {company.why}
        </p>
      </div>
    </div>
  );
}

/** One half of the full-screen split: photo with Velho's navy shade, logo and stats. Sized to never scroll. */
export function CompanyPanel({ company, metric, revealed, value, children }: Props) {
  const m = METRICS[metric];
  const raw = m.value(company);
  const velhoRound = metric === "manualAds";
  // Revenue plus employees would give away revenue per employee, so hide it until the reveal.
  const showRevenue = revealed || metric !== "rpe";

  return (
    <section className="relative isolate flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden bg-navy px-4 py-3 text-center text-ivory">
      {company.image && (
        // eslint-disable-next-line @next/next/no-img-element -- full-bleed background photo
        <img src={company.image} alt="" aria-hidden className="absolute inset-0 -z-20 h-full w-full object-cover" />
      )}
      {/* Velho's hero shade: navy over the photo so ivory text always reads */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(0deg,rgb(10_27_52/0.95)_0%,rgb(10_27_52/0.78)_55%,rgb(10_27_52/0.7)_100%)]" />
      {velhoRound && <div className="pointer-events-none absolute inset-0 -z-10 bg-clay/15" />}

      {/* key: replay the entrance animation whenever a new company slides in */}
      <div key={company.id} className="animate-panel-in flex flex-col items-center">
        <CompanyLogo company={company} className="h-12 w-12 md:h-16 md:w-16" />
        <h2 className="mt-3 text-[clamp(26px,3.6vw,48px)] leading-none tracking-[-0.035em]">{company.name}</h2>
        <p className="eyebrow mt-2 text-on-dark-2">{company.industry}</p>

        <p className="mt-3 font-mono text-xs text-on-dark md:text-[13px]">
          {company.employees.toLocaleString("en")} employees
          <span className="mx-2 text-on-dark-2">/</span>
          {showRevenue ? `€${company.revenueEurM.toLocaleString("en")}M` : "€ ?"} revenue
        </p>

        <div className="mt-4 text-[clamp(40px,6vw,76px)] font-semibold leading-none tracking-[-0.035em] text-sky md:mt-6">
          {value ?? (raw === null ? "–" : m.format(raw))}
        </div>
        <p className="eyebrow mt-2 text-on-dark-2">{m.label}</p>

        {revealed && <RevealDetails company={company} metric={metric} />}
      </div>

      {children && <div className="mt-4 md:mt-6">{children}</div>}

      {company.imageCredit && (
        <a
          href={company.imageCredit.url}
          target="_blank"
          rel="noreferrer"
          className="absolute bottom-1.5 right-3 text-[10px] text-on-dark-2/70 hover:text-ivory"
        >
          Photo: {company.imageCredit.author} / {company.imageCredit.source}
        </a>
      )}
    </section>
  );
}
