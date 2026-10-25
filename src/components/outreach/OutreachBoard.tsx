"use client";

import { useMemo, useState } from "react";
import type { EmailDraft } from "@/lib/outreach/email";
import type { OutreachEntry } from "@/lib/outreach/log";
import type { Tier } from "@/lib/outreach/targets";
import { Icon } from "@/components/ui/Icon";
import { DemoLog } from "./DemoLog";
import { PipelineSteps } from "./PipelineSteps";
import { ProspectRow } from "./ProspectRow";
import type { Prospect, SendState } from "./types";

export type { Prospect } from "./types";

type Props = {
  prospects: Prospect[];
  totalTargets: number;
  totalCompanies: number;
  initialLog: OutreachEntry[];
};

type Batch = { running: boolean; message: string | null; error: string | null };

/** Per-row visual stagger during a batch, so the demo shows a queue draining like a real one would. */
const ROW_STAGGER_MS = 220;

const setAll = (ids: string[], state: SendState) => Object.fromEntries(ids.map((id) => [id, state]));

export function OutreachBoard({ prospects, totalTargets, totalCompanies, initialLog }: Props) {
  const [drafts, setDrafts] = useState<Record<string, EmailDraft>>(() =>
    Object.fromEntries(prospects.map((p) => [p.company.id, p.email])),
  );
  // Hot and warm non-agency targets start selected: that's the batch a person would most likely approve.
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(prospects.filter((p) => p.tier !== "watch" && !p.staffing).map((p) => p.company.id)),
  );
  const [states, setStates] = useState<Record<string, SendState>>({});
  const [log, setLog] = useState<OutreachEntry[]>(initialLog);
  const [batch, setBatch] = useState<Batch>({ running: false, message: null, error: null });
  const [tierFilter, setTierFilter] = useState<Tier | "all">("all");
  const [open, setOpen] = useState<string | null>(prospects[0]?.company.id ?? null);

  const visible = useMemo(
    () => (tierFilter === "all" ? prospects : prospects.filter((p) => p.tier === tierFilter)),
    [prospects, tierFilter],
  );
  const counts = useMemo(
    () => ({
      all: prospects.length,
      hot: prospects.filter((p) => p.tier === "hot").length,
      warm: prospects.filter((p) => p.tier === "warm").length,
      watch: prospects.filter((p) => p.tier === "watch").length,
      contacts: prospects.reduce((n, p) => n + p.sheet.contacts.length, 0),
    }),
    [prospects],
  );
  const selectedProspects = prospects.filter((p) => selected.has(p.company.id));
  const loggedIds = useMemo(() => new Set(log.map((e) => e.companyId)), [log]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectAll = (on: boolean) => setSelected(on ? new Set(visible.map((p) => p.company.id)) : new Set());

  const updateDraft = (id: string, patch: Partial<EmailDraft>) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  /**
   * DEMO SEND. Posts the drafts to /api/outreach, which records them and sends nothing.
   * The staggered "queued → sending" states are purely visual.
   */
  const sendAll = async () => {
    if (selectedProspects.length === 0 || batch.running) return;
    setBatch({ running: true, message: null, error: null });
    const ids = selectedProspects.map((p) => p.company.id);
    setStates((prev) => ({ ...prev, ...setAll(ids, "queued") }));
    const timers = ids.map((id, i) =>
      setTimeout(() => setStates((prev) => (prev[id] === "queued" ? { ...prev, [id]: "sending" } : prev)), i * ROW_STAGGER_MS),
    );

    try {
      const response = await fetch("/api/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          drafts: selectedProspects.map((p) => ({
            companyId: p.company.id,
            companyName: p.company.name,
            to: drafts[p.company.id].to,
            subject: drafts[p.company.id].subject,
          })),
        }),
      });
      const data = await response.json();
      timers.forEach(clearTimeout);
      if (!response.ok) {
        setStates((prev) => ({ ...prev, ...setAll(ids, "error") }));
        setBatch({ running: false, message: null, error: data.error ?? "Something went wrong." });
        return;
      }
      // Let the last rows finish their visual pass before flipping everything to "simulated".
      await new Promise((r) => setTimeout(r, Math.min(ids.length, 8) * ROW_STAGGER_MS));
      setStates((prev) => ({ ...prev, ...setAll(ids, "simulated") }));
      setLog((prev) => [...(data.entries as OutreachEntry[]), ...prev]);
      setBatch({ running: false, message: data.message, error: null });
    } catch {
      timers.forEach(clearTimeout);
      setStates((prev) => ({ ...prev, ...setAll(ids, "error") }));
      setBatch({ running: false, message: null, error: "Couldn't reach the server. Nothing was sent either way." });
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 md:px-8">
      {/* Demo banner: always visible, never dismissible */}
      <div className="flex items-start gap-3 rounded-[14px] border border-clay/40 bg-clay/10 px-5 py-4 text-sm text-ink" role="status">
        <Icon name="lock" className="mt-0.5 h-4 w-4 shrink-0 text-clay" />
        <p>
          <strong className="font-semibold">Demo mode.</strong> This desk finds targets, resolves contacts and drafts emails from
          the job-ad data already in the project. The Send button records what <em>would</em> go out to{" "}
          <code className="font-mono text-xs">.data/outreach-log.json</code> and{" "}
          <strong className="font-semibold">does not send any email</strong>. There is no mail integration in this codebase.
        </p>
      </div>

      <p className="eyebrow mt-10 text-sage-d">Outreach desk</p>
      <h1 className="mt-3 text-[clamp(32px,4.4vw,52px)] leading-none tracking-[-0.04em]">Invite the right companies to play</h1>
      <p className="mt-4 max-w-2xl text-lg text-ink-2">
        Companies whose open job ads describe routine work, with a proposal to try <em>Who&apos;s hiring?</em> and see what
        Velho found in their own words.
      </p>

      <PipelineSteps
        scanned={totalCompanies}
        found={totalTargets}
        shortlisted={prospects.length}
        contacts={counts.contacts}
        drafted={prospects.length}
        selected={selected.size}
      />

      {/* Toolbar */}
      <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {(["all", "hot", "warm", "watch"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTierFilter(t)}
              className={`rounded-full border px-3 py-1.5 text-sm capitalize transition ${
                tierFilter === t ? "border-navy bg-navy text-ivory" : "border-sand-2 bg-white text-ink-2 hover:border-navy-3"
              }`}
            >
              {t} <span className="ml-1 font-mono text-xs opacity-70">{counts[t]}</span>
            </button>
          ))}
          <span className="mx-1 hidden h-5 w-px bg-sand-2 sm:block" />
          <button onClick={() => selectAll(true)} className="text-sm text-navy-3 hover:text-ink">
            Select all shown
          </button>
          <button onClick={() => selectAll(false)} className="text-sm text-navy-3 hover:text-ink">
            Clear
          </button>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-ink-3">
              {selected.size} selected · {log.length} in demo log
            </span>
            <button
              onClick={sendAll}
              disabled={selected.size === 0 || batch.running}
              className="btn btn-dark"
              title="Demo: records the drafts, sends nothing"
              data-testid="send-all"
            >
              {batch.running ? (
                <>
                  <Icon name="spark" className="h-4 w-4 animate-spin" /> Simulating…
                </>
              ) : (
                <>
                  Send to {selected.size} {selected.size === 1 ? "company" : "companies"} <Icon name="arrowRight" />
                </>
              )}
            </button>
          </div>
          <p className="text-xs text-ink-3">Demo: nothing is sent. The batch is written to the log below.</p>
        </div>
      </div>

      {batch.message && (
        <p className="animate-rise mt-4 flex items-center gap-2 rounded-[9px] bg-sage/15 px-4 py-3 text-sm text-sage-d" role="status">
          <Icon name="check" /> {batch.message}
        </p>
      )}
      {batch.error && (
        <p className="animate-rise mt-4 rounded-[9px] bg-clay/10 px-4 py-3 text-sm text-clay" role="alert">
          {batch.error}
        </p>
      )}

      {/* Prospect list */}
      <ol className="mt-6 flex flex-col gap-3">
        {visible.map((p) => (
          <ProspectRow
            key={p.company.id}
            index={prospects.indexOf(p) + 1}
            prospect={p}
            draft={drafts[p.company.id]}
            selected={selected.has(p.company.id)}
            state={states[p.company.id] ?? "idle"}
            alreadyLogged={loggedIds.has(p.company.id)}
            open={open === p.company.id}
            onToggleOpen={() => setOpen((o) => (o === p.company.id ? null : p.company.id))}
            onToggleSelect={() => toggle(p.company.id)}
            onDraftChange={(patch) => updateDraft(p.company.id, patch)}
          />
        ))}
      </ol>
      {visible.length === 0 && <p className="card mt-6 p-6 text-sm text-ink-3">No companies in this tier.</p>}

      <DemoLog log={log} />
    </main>
  );
}
