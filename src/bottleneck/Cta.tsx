"use client";

import { useState, type FormEvent } from "react";
import type { Game } from "./engine";
import type { Score } from "./score";
import { track } from "./analytics";
import { submitLead } from "./submit";
import { t } from "./strings";

type Props = { g: Game; score: Score; totalScore: number; levelsWon: number; headline: string };

/** Conversion form. Client-side validation only; the single exit is submitLead() in submit.ts. */
export function Cta({ g, score, totalScore, levelsWon, headline }: Props) {
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const v = (k: string) => String(f.get(k) ?? "").trim();
    const errs: Record<string, string> = {};
    if (!v("name")) errs.name = t.cta.errName;
    if (!v("company")) errs.company = t.cta.errCompany;
    if (!v("role")) errs.role = t.cta.errRole;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v("email"))) errs.email = t.cta.errEmail;
    if (f.get("consent") !== "on") errs.consent = t.cta.errConsent;
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setState("sending");
    const res = await submitLead({
      name: v("name"), company: v("company"), role: v("role"), email: v("email"), pain: v("pain"), consent: true,
      scenarioId: g.scn.id, industry: g.scn.industry, score: score.total, totalScore, costCutPct: score.costCutPct,
      levelsWon, timeToFind: score.timeToFind, seed: g.seed,
      difficulty: g.scn.meta?.difficulty ?? 0, theme: g.scn.meta?.theme ?? g.scn.id, skipped: g.skippedAt !== null,
    });
    track("cta_submit", { scenario: g.scn.id, ok: res.ok, via: res.via });
    if (res.ok) setState("done");
    else {
      setErrors({ form: t.cta.errSave });
      setState("idle");
    }
  };

  if (state === "done") {
    return (
      <div className="bn-cta" role="status">
        <h3>{t.cta.done}</h3>
      </div>
    );
  }
  const field = (name: string, label: string, props: Record<string, string> = {}) => (
    <label>
      {label}
      <input name={name} aria-invalid={!!errors[name]} {...props} />
      {errors[name] && <span className="bn-err" role="alert">{errors[name]}</span>}
    </label>
  );
  return (
    <div className="bn-cta">
      <p className="eyebrow" style={{ color: "var(--color-sky)" }}>{headline}</p>
      <h3>{t.cta.title}</h3>
      <p>{t.cta.sub}</p>
      <form className="bn-form bn-grid" onSubmit={submit} noValidate>
        {field("name", t.cta.name, { autoComplete: "name" })}
        {field("company", t.cta.company, { autoComplete: "organization" })}
        {field("role", t.cta.role, { autoComplete: "organization-title" })}
        {field("email", t.cta.email, { type: "email", autoComplete: "email" })}
        <label className="bn-wide">
          {t.cta.pain}
          <textarea name="pain" rows={2} maxLength={600} />
        </label>
        <label className="bn-check bn-wide">
          <input type="checkbox" name="consent" aria-invalid={!!errors.consent} />
          <span>{t.cta.consent}</span>
        </label>
        {errors.consent && <span className="bn-err bn-wide" role="alert">{errors.consent}</span>}
        {errors.form && <span className="bn-err bn-wide" role="alert">{errors.form}</span>}
        <button type="submit" className="btn btn-light bn-wide" disabled={state === "sending"}>
          {state === "sending" ? t.cta.sending : t.cta.submit}
        </button>
      </form>
    </div>
  );
}
