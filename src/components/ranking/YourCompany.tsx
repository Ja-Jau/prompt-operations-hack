"use client";

import { useState, type FormEvent } from "react";
import type { Company, LookupResult } from "@/types/company";
import { formatEur } from "@/lib/format";
import { revenuePerEmployee } from "@/lib/game/rules";
import { placeOnLadder } from "@/lib/ranking";
import { CompanyLogo } from "@/components/game/CompanyLogo";

const VELHO_URL = process.env.NEXT_PUBLIC_VELHO_URL ?? "#";

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
      className={`flex items-center gap-3 rounded-xl px-3 py-2 ${highlight ? "bg-amber-300 text-neutral-900" : "bg-white/5"}`}
    >
      {company ? (
        <CompanyLogo company={company} className="h-8 w-8 rounded-lg p-1" />
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 text-[10px] font-black text-amber-300">
          YOU
        </div>
      )}
      <span className="flex-1 truncate text-left font-semibold">{highlight ?? company?.name}</span>
      <span className="tabular-nums">{formatEur(rpe)}</span>
    </div>
  );
}

/** "Where does YOUR company rank?": type a name, get placed on the ladder of real companies. */
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
    <section className="w-full rounded-3xl border border-white/10 bg-white/5 p-5">
      <h3 className="text-xl font-bold">Where does your company rank?</h3>
      <p className="mt-1 text-sm text-white/60">Just type the name. Velho looks up the numbers.</p>

      <form onSubmit={submit} className="mt-4 flex gap-2">
        <input
          list="tehokas-companies"
          className="min-w-0 flex-1 rounded-xl border border-white/15 bg-white/5 px-4 py-3 outline-none focus:border-amber-300"
          placeholder="e.g. Paulig"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
        />
        <datalist id="tehokas-companies">
          {companies.map((c) => (
            <option key={c.id} value={c.name} />
          ))}
        </datalist>
        <button
          type="submit"
          disabled={state.status === "loading"}
          className="rounded-xl bg-amber-300 px-5 font-semibold text-neutral-900 hover:bg-amber-200 disabled:opacity-50"
        >
          Rank it
        </button>
      </form>

      {state.status === "loading" && (
        <p className="mt-4 animate-pulse text-sm text-white/70">
          ⚡ Velho is looking up {state.name}&apos;s latest figures… (about 20 seconds)
        </p>
      )}
      {state.status === "not-found" && (
        <p className="mt-4 text-sm text-white/70">
          Couldn&apos;t find reliable public figures for {state.name}. Try the full company name.
        </p>
      )}
      {state.status === "error" && <p className="mt-4 text-sm text-rose-300">{state.message}</p>}
      {state.status === "found" && <Placement companies={companies} result={state.result} datasetId={state.datasetId} />}
    </section>
  );
}

function Placement({ companies, result, datasetId }: { companies: Company[]; result: LookupResult; datasetId?: string }) {
  const rpe = (result.revenueEurM * 1_000_000) / result.employees;
  const place = placeOnLadder(companies, rpe, datasetId);

  return (
    <div className="mt-4 space-y-3">
      <p>
        <strong>{result.name}</strong> is <strong className="text-amber-300">#{place.rank}</strong> of {place.total}
      </p>
      <div className="space-y-1.5 text-sm">
        {place.above && <LadderRow company={place.above} rpe={revenuePerEmployee(place.above)} />}
        <LadderRow company={null} rpe={rpe} highlight={result.name} />
        {place.below && <LadderRow company={place.below} rpe={revenuePerEmployee(place.below)} />}
      </div>
      <p className="text-sm text-white/80">
        {place.above ? (
          <>
            To overtake <strong>{place.above.name}</strong>: free up about{" "}
            <strong className="text-amber-300">{place.hoursToOvertake.toFixed(1)} h per person per week</strong>.
          </>
        ) : (
          <>Top of the board. Velho helps companies stay there.</>
        )}
      </p>
      <a
        href={VELHO_URL}
        className="inline-block rounded-full bg-amber-300 px-5 py-2.5 font-semibold text-neutral-900 hover:bg-amber-200"
      >
        Find those hours with Velho →
      </a>
      <p className="text-[11px] text-white/40">
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
