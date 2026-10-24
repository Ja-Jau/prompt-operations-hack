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
    const { example, checked, manual } = company.jobAds;
    return (
      <div className="animate-rise mt-2 flex max-w-md flex-col items-center gap-2">
        <p className="text-xs text-white/70 md:text-sm">
          {manual} of {checked} open job ads read
        </p>
        {example && (
          <a
            href={example.url}
            target="_blank"
            rel="noreferrer"
            className="hidden rounded-2xl border border-amber-300/30 bg-neutral-950/60 px-4 py-2 text-left text-sm backdrop-blur hover:border-amber-300/60 md:block"
          >
            <span className="line-clamp-2 italic text-white/90">“{example.quote}”</span>
            <span className="mt-1 block text-xs text-amber-300">{example.title} →</span>
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="animate-rise flex flex-col items-center">
      <p className="text-xs text-white/75 md:text-sm">
        ≈ <strong className="text-white">€{Math.round(revenuePerHour(company))}</strong> per working hour
      </p>
      <div className="mt-2 hidden max-w-md md:block">
        <p className="line-clamp-2 text-sm text-white/90">
          <span className="font-semibold text-amber-300">Velho insight: </span>
          {company.why}
        </p>
      </div>
    </div>
  );
}

/** One half of the split screen: photo background, logo and stats. Sized to never scroll. */
export function CompanyPanel({ company, metric, revealed, value, children }: Props) {
  const m = METRICS[metric];
  const raw = m.value(company);
  const velhoRound = metric === "manualAds";
  // Revenue plus employees would give away revenue per employee, so hide it until the reveal.
  const showRevenue = revealed || metric !== "rpe";

  return (
    <section className="relative isolate flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden bg-neutral-900 px-4 py-3 text-center">
      {company.image && (
        // eslint-disable-next-line @next/next/no-img-element -- full-bleed background photo
        <img
          src={company.image}
          alt=""
          aria-hidden
          className="absolute inset-0 -z-20 h-full w-full scale-105 object-cover blur-[2px]"
        />
      )}
      {/* Dark scrim + vignette so white text stays readable on any photo */}
      <div className="absolute inset-0 -z-10 bg-neutral-950/65" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgb(0_0_0/0.6)_100%)]" />
      {velhoRound && <div className="pointer-events-none absolute inset-0 -z-10 bg-amber-400/10" />}

      {/* key: replay the entrance animation whenever a new company slides in */}
      <div key={company.id} className="animate-panel-in flex flex-col items-center">
        <CompanyLogo company={company} className="h-12 w-12 md:h-20 md:w-20" />

        <h2 className="mt-2 text-2xl font-black leading-tight tracking-tight drop-shadow-lg md:mt-3 md:text-5xl">
          {company.name}
        </h2>
        <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-white/60 md:text-xs">{company.industry}</p>

        <div className="mt-2 flex gap-2 text-xs md:mt-3 md:text-sm">
          <span className="rounded-full bg-white/10 px-3 py-1 backdrop-blur">
            <strong className="tabular-nums">{company.employees.toLocaleString("en")}</strong> employees
          </span>
          <span className="rounded-full bg-white/10 px-3 py-1 backdrop-blur">
            <strong className="tabular-nums">{showRevenue ? `€${company.revenueEurM.toLocaleString("en")}M` : "€ ?"}</strong>{" "}
            revenue
          </span>
        </div>

        <div className="mt-3 text-4xl font-black text-amber-300 drop-shadow-[0_0_28px_rgb(252_211_77/0.35)] md:mt-4 md:text-7xl">
          {value ?? (raw === null ? "–" : m.format(raw))}
        </div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-white/60 md:text-xs">{m.label}</p>

        {revealed && <RevealDetails company={company} metric={metric} />}
      </div>

      {children && <div className="mt-3 md:mt-5">{children}</div>}

      {company.imageCredit && (
        <a
          href={company.imageCredit.url}
          target="_blank"
          rel="noreferrer"
          className="absolute bottom-1 right-2 text-[10px] text-white/35 hover:text-white/70"
        >
          Photo: {company.imageCredit.author} / {company.imageCredit.source}
          {company.imageCredit.license && ` (${company.imageCredit.license})`}
        </a>
      )}
    </section>
  );
}
