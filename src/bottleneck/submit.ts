/**
 * The ONE place a lead leaves the game. Today it posts to a local dev endpoint that appends to
 * .data/bottleneck-leads.json, and falls back to localStorage. To go live, change the body of
 * submitLead() to call a CRM webhook. Nothing else needs to change.
 */
export type LeadPayload = {
  name: string;
  company: string;
  role: string;
  email: string;
  pain: string;
  consent: boolean;
  scenarioId: string;
  industry: string;
  score: number;
  totalScore: number;
  costCutPct: number;
  levelsWon: number;
  timeToFind: number | null;
  seed: number;
  difficulty: number;
  theme: string;
  skipped: boolean;
};

const LS_KEY = "bottleneck-leads";

export async function submitLead(payload: LeadPayload): Promise<{ ok: boolean; via: "api" | "local" }> {
  const record = { ...payload, createdAt: new Date().toISOString() };
  console.log("[lead]", record);
  try {
    const res = await fetch("/fix-the-bottleneck/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
    });
    if (res.ok) return { ok: true, via: "api" };
  } catch {
    /* fall through to localStorage */
  }
  try {
    const old = JSON.parse(localStorage.getItem(LS_KEY) ?? "[]");
    localStorage.setItem(LS_KEY, JSON.stringify([record, ...old]));
    return { ok: true, via: "local" };
  } catch {
    return { ok: false, via: "local" };
  }
}
