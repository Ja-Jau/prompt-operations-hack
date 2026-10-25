"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { GameCompany as Company } from "@/types/company";
import { METRICS, metricObservation, type MetricId } from "@/lib/game/metrics";
import { formatEur } from "@/lib/format";
import { CompanyLogo } from "./CompanyLogo";
import { companyPhotoFallback } from "@/lib/data/company-images";

type Props = {
  company: Company;
  metric: MetricId;
  revealed: boolean;
  value?: ReactNode;
  children?: ReactNode;
};

function RevealDetails({ company, metric }: { company: Company; metric: MetricId }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const observation = metricObservation(company, metric);
  if (!observation) return null;
  const { inputs, sources } = observation;
  return (
    <div className="animate-rise mt-1 max-w-md text-xs text-on-dark sm:text-sm">
      <button onClick={() => dialog.current?.showModal()} className="cursor-pointer text-xs text-sky hover:underline">Sources</button>
      <dialog ref={dialog} aria-label={`${company.name}: sources and calculation`} className="fixed inset-0 m-auto max-h-[80dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-line-dark bg-navy p-5 text-left text-ivory shadow-2xl backdrop:bg-black/60">
        <button autoFocus onClick={() => dialog.current?.close()} className="float-right rounded px-3 py-1 text-sky hover:bg-white/10">Close</button>
        <h3 className="pr-16 font-semibold">{company.name} · {METRICS[metric].title}</h3>
        <p className="mt-2 text-xs">{observation.note}</p>
        <p className="mt-2 text-xs">{observation.period}</p>
        {metric === "manualAds" && <p className="mt-2 text-xs">{inputs.manual} of {inputs.checked} sampled ads mention repetitive tasks.</p>}
        {metric === "growthGap" && <p className="mt-2 text-xs">Revenue {((inputs.revenue / inputs.previousRevenue - 1) * 100).toFixed(1)}% · Employees {((inputs.employees / inputs.previousEmployees - 1) * 100).toFixed(1)}%</p>}
        {metric === "adminRatio" && <p className="mt-2 text-xs">Administration {formatEur(Math.abs(inputs.administrativeExpenses))} / revenue {formatEur(inputs.revenue)}</p>}
        {metric === "inventoryDays" && <p className="mt-2 text-xs">Opening inventory {formatEur(inputs.previousInventory)} · Closing inventory {formatEur(inputs.inventory)} · Annual cost of sales {formatEur(Math.abs(inputs.costOfSales))}</p>}
        {metric === "growthGap" && <p className="mt-2 text-xs">Employee basis: {observation.definition.endsWith("averageFte") ? "average full-time equivalents" : observation.definition.endsWith("closingHeadcount") ? "headcount at year end" : "average headcount"}</p>}
        <p className="mt-1 text-xs">{observation.scope === "consolidated" ? "Company group" : "Job-ad sample"} · Retrieved {observation.fetchedAt.slice(0, 10)}</p>
        <ul className="mt-2 space-y-2">
          {sources.map((source, i) => (
            <li key={`${source.url}-${i}`}>
              <a href={source.url} target="_blank" rel="noreferrer" className="text-xs text-sky underline">
                {source.label}
              </a>
              {metric === "manualAds" && <p className="mt-1 break-words text-xs">{source.evidence}</p>}
            </li>
          ))}
        </ul>
      </dialog>
    </div>
  );
}

/** A company, its sourced observation, and evidence after the reveal. */
export function CompanyPanel({ company, metric, revealed, value, children }: Props) {
  const m = METRICS[metric];
  const raw = m.value(company);
  const fallback = company.image ? { image: company.image, imageCredit: company.imageCredit } : companyPhotoFallback(company);
  const [photo, setPhoto] = useState<{ id: string; image: string; imageCredit: Company["imageCredit"]; kind: string } | null>(null);
  const [broken, setBroken] = useState<string | null>(null);
  const activePhoto = photo?.id === company.id && broken !== photo.image ? photo : fallback;
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/companies/photo?id=${encodeURIComponent(company.id)}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((result) => { if (result?.image) setPhoto({ ...result, id: company.id }); })
      .catch(() => { /* Local artwork remains visible. */ });
    return () => controller.abort();
  }, [company.id]);

  return (
    <section className="higher-lower-panel relative isolate flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center overflow-hidden bg-navy px-3 py-3 text-center text-ivory sm:px-5">
      {activePhoto.image && (
        // eslint-disable-next-line @next/next/no-img-element -- full-bleed background photo
        <img src={activePhoto.image} onError={() => setBroken(activePhoto.image)} alt="" aria-hidden className="absolute inset-0 -z-20 h-full w-full object-cover" />
      )}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(0deg,rgb(10_27_52/0.95)_0%,rgb(10_27_52/0.78)_55%,rgb(10_27_52/0.7)_100%)]" />

      <div key={`${company.id}-${metric}`} className="animate-panel-in flex flex-col items-center">
        <CompanyLogo key={company.id} company={company} className="higher-lower-logo h-7 w-7 sm:h-12 sm:w-12" />
        <h2 className="mt-1 text-[clamp(20px,3.5dvh,40px)] leading-none tracking-[-0.035em]">{company.name}</h2>
        <div className="mt-2 text-[clamp(30px,6dvh,64px)] font-semibold leading-none tracking-[-0.035em] text-sky">
          {value ?? (raw === null ? "–" : m.format(raw))}
        </div>
        <p className="mt-1 max-w-sm font-mono text-[10px] leading-tight text-on-dark-2 sm:text-xs">{m.label}</p>
        {revealed && <RevealDetails company={company} metric={metric} />}
      </div>

      {children && <div className="mt-2 sm:mt-3">{children}</div>}
      {activePhoto.imageCredit && (
        <a href={activePhoto.imageCredit.url} target="_blank" rel="noreferrer" title={`${activePhoto.imageCredit.author} / ${activePhoto.imageCredit.source}`}
          className="absolute bottom-1.5 right-3 max-w-[calc(100%-1.5rem)] truncate text-[10px] text-on-dark-2/70 hover:text-ivory">
          {photo?.id === company.id && activePhoto === photo && photo.kind === "company" ? "Company image" : "Industry photo"} · {activePhoto.imageCredit.author}
        </a>
      )}
    </section>
  );
}
