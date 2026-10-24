"use client";

import { useState, type FormEvent } from "react";
import { Icon } from "@/components/ui/Icon";

type Props = {
  /** Where the form sits, stored with the lead, e.g. "case-reveal". */
  source: string;
  contextCompanyId?: string;
  /** Styling for a navy or a cream background. */
  tone?: "dark" | "light";
  cta?: string;
};

/** Name, work email, company: the step from player to conversation. */
export function LeadForm({ source, contextCompanyId, tone = "dark", cta = "Get the analysis" }: Props) {
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const dark = tone === "dark";
  const input = dark
    ? "border-line-dark bg-ivory/10 text-ivory placeholder:text-on-dark-2 focus:border-on-dark-2"
    : "border-sand-2 bg-white text-ink placeholder:text-ink-3 focus:border-navy-3";

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    setStatus("sending");
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, source, contextCompanyId }),
      });
      if (!response.ok) {
        setError((await response.json()).error ?? "Something went wrong.");
        setStatus("error");
        return;
      }
      setStatus("done");
    } catch {
      setError("Couldn't reach the server.");
      setStatus("error");
    }
  };

  if (status === "done") {
    return (
      <p className={`animate-rise flex items-center gap-2 font-medium ${dark ? "text-ivory" : "text-ink"}`}>
        <Icon name="check" className={`h-5 w-5 shrink-0 ${dark ? "text-sky" : "text-sage-d"}`} />
        Thanks. Velho will send your analysis and suggest a time to talk.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-2 sm:grid-cols-3">
      <input name="name" required placeholder="Your name" autoComplete="name" className={`rounded-[9px] border px-4 py-3 outline-none ${input}`} />
      <input
        name="email"
        type="email"
        required
        placeholder="Work email"
        autoComplete="email"
        className={`rounded-[9px] border px-4 py-3 outline-none ${input}`}
      />
      <input
        name="company"
        required
        placeholder="Company"
        autoComplete="organization"
        className={`rounded-[9px] border px-4 py-3 outline-none ${input}`}
      />
      <div className="mt-2 flex flex-wrap items-center gap-4 sm:col-span-3">
        <button type="submit" disabled={status === "sending"} className={`btn ${dark ? "btn-light" : "btn-dark"}`}>
          {status === "sending" ? "Sending" : cta} <Icon name="arrowRight" />
        </button>
        <span className={`text-xs ${dark ? "text-on-dark-2" : "text-ink-3"}`}>
          Velho uses this only to reply to you.
        </span>
      </div>
      {status === "error" && <p className="text-sm text-clay sm:col-span-3">{error}</p>}
    </form>
  );
}
