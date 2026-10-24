"use client";

import type { ReactNode } from "react";
import type { Company } from "@/types/company";
import { formatEur } from "@/lib/format";
import { revenuePerEmployee, revenuePerHour } from "@/lib/game/rules";
import { CompanyLogo } from "./CompanyLogo";

type Props = {
  company: Company;
  /** Whether revenue and the answer are shown. Employees are always shown: a fair clue, not the answer. */
  revealed: boolean;
  /** Replaces the big number, e.g. a "?" or a rolling counter. */
  value?: ReactNode;
  /** Shown under the stats, e.g. the Higher/Lower buttons. */
  children?: ReactNode;
};

/** One half of the split screen: photo background, logo and stats. Sized to never scroll. */
export function CompanyPanel({ company, revealed, value, children }: Props) {
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

      {/* key: restart the logo fallback chain when a new company slides in */}
      <CompanyLogo key={company.id} company={company} className="h-12 w-12 md:h-20 md:w-20" />

      <h2 className="mt-2 text-2xl font-black leading-tight drop-shadow-lg md:mt-3 md:text-5xl">{company.name}</h2>
      <p className="text-[11px] uppercase tracking-widest text-white/70 md:text-xs">{company.industry}</p>

      <p className="mt-2 text-xs text-white/85 md:mt-3 md:text-sm">
        <strong className="tabular-nums">{company.employees.toLocaleString("en")}</strong> employees ·{" "}
        <strong className="tabular-nums">{revealed ? `€${company.revenueEurM.toLocaleString("en")}M` : "€?"}</strong>{" "}
        revenue
      </p>

      <p className="mt-2 text-[11px] uppercase tracking-widest text-white/60 md:mt-3">revenue per employee</p>
      <div className="text-4xl font-black text-amber-300 drop-shadow-lg md:text-6xl">
        {value ?? formatEur(revenuePerEmployee(company))}
      </div>

      {revealed && (
        <>
          <p className="text-xs text-white/75 md:text-sm">
            ≈ <strong className="text-white">€{Math.round(revenuePerHour(company))}</strong> per working hour
          </p>
          <div className="mt-2 hidden max-w-md md:block">
            <p className="line-clamp-2 text-sm text-white/90">
              <span className="font-semibold text-amber-300">Velho insight: </span>
              {company.why}
            </p>
          </div>
        </>
      )}

      {children && <div className="mt-2 md:mt-4">{children}</div>}

      {company.imageCredit && (
        <a
          href={company.imageCredit.url}
          target="_blank"
          rel="noreferrer"
          className="absolute bottom-1 right-2 text-[10px] text-white/40 hover:text-white/70"
        >
          Photo: {company.imageCredit.author} / {company.imageCredit.source}
          {company.imageCredit.license && ` (${company.imageCredit.license})`}
        </a>
      )}
    </section>
  );
}
