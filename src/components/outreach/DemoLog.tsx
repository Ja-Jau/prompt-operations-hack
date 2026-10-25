"use client";

import type { OutreachEntry } from "@/lib/outreach/log";

/** What the Send button recorded. Every row is a simulation; the badge says so on each line. */
export function DemoLog({ log }: { log: OutreachEntry[] }) {
  return (
    <section className="mt-14">
      <p className="eyebrow mb-4 text-sage-d">Demo send log</p>
      {log.length === 0 ? (
        <p className="card p-5 text-sm text-ink-3">
          Nothing recorded yet. Select companies above and press Send to see the batch land here.
        </p>
      ) : (
        <ul className="card divide-y divide-sand-2">
          {log.slice(0, 30).map((entry) => (
            <li key={entry.id} className="grid gap-1 p-4 text-sm sm:grid-cols-[1fr_auto]">
              <div className="min-w-0">
                <p className="truncate font-semibold">
                  {entry.companyName} <span className="font-normal text-ink-3">→ {entry.to}</span>
                </p>
                <p className="truncate text-ink-2">{entry.subject}</p>
              </div>
              <div className="flex items-center gap-2 sm:justify-end">
                <span className="rounded-full bg-sky/20 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-navy">
                  Simulated
                </span>
                <span className="font-mono text-[11px] text-ink-3">{new Date(entry.createdAt).toLocaleString("en-GB")}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-ink-3">
        Every row carries <code className="font-mono">simulated: true</code>. A production version would hand each draft to a
        person at Velho for approval before anything is sent.
      </p>
    </section>
  );
}
