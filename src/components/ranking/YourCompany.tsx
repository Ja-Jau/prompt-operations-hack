"use client";

import { useState, type FormEvent } from "react";
import type { Company, LookupResult } from "@/types/company";
import { formatEur } from "@/lib/format";
import { revenuePerEmployee } from "@/lib/game/rules";
import { placeOnLadder } from "@/lib/ranking";
import { CompanyLogo } from "@/components/game/CompanyLogo";
import { VELHO_URL } from "@/lib/velho";
import { Icon } from "@/components/ui/Icon";

type State =
  | { status: "idle" }
  | { status: "loading"; name: string }
  | { status: "found"; result: LookupResult; datasetId?: string }
  | { status: "not-found"; name: string }
  | { status: "error"; message: string };

function fromDataset(c: Company): LookupResult {
  return {
    name: c.name,
    industry: c.industry,
    revenueEurM: c.revenueEurM,
    employees: c.employees,
    fiscalYear: c.fiscalYear,
    why: c.why,
    sources: c.sourceUrl ? [c.sourceUrl] : [],
    origin: "dataset",
  };
}

function LadderRow({ company, rpe, highlight }: { company: Company | null; rpe: number; highlight?: string }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-[9px] px-3 py-2 ${
        highlight ? "bg-navy text-ivory" : "border border-sand-2 bg-white text-ink"
      }`}
    >
      {company ? (
        <CompanyLogo company={company} className="h-8 w-8 rounded-[7px] p-1" />
      ) : (
        <span className="eyebrow flex h-8 w-8 items-center justify-center rounded-[7px] bg-sky/20 text-[10px] text-sky">
          You
        </span>
      )}
      <span className="flex-1 truncate font-medium">{highlight ?? company?.name}</span>
      <span className="font-mono text-sm tabular-nums">{formatEur(rpe)}</span>
    </div>
  );
}

/** "What would Velho find in yours?": type a name, get placed on the ladder of real companies. */
export function YourCompany({ companies }: { companies: Company[] }) {
  const [name, setName] = useState("");
  const [state, setState] = useState<State>({ status: "idle" });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const query = name.trim();
    if (!query) return;

    // Companies already in the game answer instantly; anything else goes to the AI lookup.
    const known = companies.find((c) => c.name.toLowerCase() === query.toLowerCase());
    if (known) {
      setState({ status: "found", result: fromDataset(known), datasetId: known.id });
      return;
    }

    setState({ status: "loading", name: query });
    try {
      const response = await fetch("/api/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: query }),
      });
      const data = await response.json();
      if (!response.ok) setState({ status: "error", message: data.error ?? "Lookup failed." });
      else if (data.result) setState({ status: "found", result: data.result });
      else setState({ status: "not-found", name: query });
    } catch {
      setState({ status: "error", message: "Couldn't reach the server." });
    }
  };

  return (
    <section className="card w-full p-6 text-ink">
      <form onSubmit={submit} className="flex gap-2">
        <input
          list="tehokas-companies"
          className="min-w-0 flex-1 rounded-[9px] border border-sand-2 bg-white px-4 py-3 outline-none transition placeholder:text-ink-3 focus:border-navy-3"
          placeholder="Your company, e.g. Paulig"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
        />
        <datalist id="tehokas-companies">
          {companies.map((c) => (
            <option key={c.id} value={c.name} />
          ))}
        </datalist>
        <button type="submit" disabled={state.status === "loading"} className="btn btn-dark">
          Look up
        </button>
      </form>

      {state.status === "loading" && (
        <p className="mt-4 animate-pulse text-sm text-ink-2">
          Velho is looking up {state.name}&apos;s latest public figures. This takes about 20 seconds.
        </p>
      )}
      {state.status === "not-found" && (
        <p className="mt-4 text-sm text-ink-2">
          Couldn&apos;t find reliable public figures for {state.name}. Try the full company name.
        </p>
      )}
      {state.status === "error" && <p className="mt-4 text-sm text-clay">{state.message}</p>}
      {state.status === "found" && <Placement companies={companies} result={state.result} datasetId={state.datasetId} />}
    </section>
  );
}

function Placement({ companies, result, datasetId }: { companies: Company[]; result: LookupResult; datasetId?: string }) {
  const rpe = (result.revenueEurM * 1_000_000) / result.employees;
  const place = placeOnLadder(companies, rpe, datasetId);

  return (
    <div className="animate-rise mt-6 space-y-4">
      <p className="eyebrow text-sage-d">
        Rank {place.rank} of {place.total} on revenue per employee
      </p>
      <div className="space-y-1.5 text-sm">
        {place.above && <LadderRow company={place.above} rpe={revenuePerEmployee(place.above)} />}
        <LadderRow company={null} rpe={rpe} highlight={result.name} />
        {place.below && <LadderRow company={place.below} rpe={revenuePerEmployee(place.below)} />}
      </div>
      <p className="text-[15px] text-ink-2">
        {place.above ? (
          <>
            To overtake <strong className="text-ink">{place.above.name}</strong>, free up about{" "}
            <strong className="text-ink">{place.hoursToOvertake.toFixed(1)} hours per person per week</strong>.
          </>
        ) : (
          <>Top of the list. Velho helps companies stay there.</>
        )}
      </p>
      <a href={VELHO_URL} target="_blank" rel="noreferrer" className="btn btn-dark">
        Find those hours with Velho <Icon name="arrowRight" />
      </a>
      <p className="text-[11px] text-ink-3">
        {result.origin === "ai" ? "Figures found by AI from public sources and may be off. " : ""}
        FY{result.fiscalYear}: €{result.revenueEurM.toLocaleString("en")}M, {result.employees.toLocaleString("en")}{" "}
        employees.{" "}
        {result.sources.slice(0, 3).map((url, i) => (
          <a key={url} href={url} target="_blank" rel="noreferrer" className="mr-1 underline">
            [{i + 1}]
          </a>
        ))}
      </p>
    </div>
  );
}
