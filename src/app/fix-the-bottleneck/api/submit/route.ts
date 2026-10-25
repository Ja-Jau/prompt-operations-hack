import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

/** Dev-only endpoint: appends the lead to .data/bottleneck-leads.json. Sends nothing anywhere. */
const FILE = path.join(process.cwd(), ".data", "bottleneck-leads.json");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const text = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export async function POST(request: Request) {
  const b = await request.json().catch(() => null);
  const lead = {
    id: randomUUID(),
    name: text(b?.name),
    company: text(b?.company),
    role: text(b?.role),
    email: text(b?.email),
    pain: text(b?.pain, 600),
    consent: b?.consent === true,
    scenarioId: text(b?.scenarioId),
    industry: text(b?.industry),
    score: num(b?.score),
    totalScore: num(b?.totalScore),
    costCutPct: num(b?.costCutPct),
    levelsWon: num(b?.levelsWon),
    timeToFind: num(b?.timeToFind),
    seed: num(b?.seed),
    difficulty: num(b?.difficulty),
    theme: text(b?.theme),
    skipped: b?.skipped === true,
    createdAt: new Date().toISOString(),
  };
  if (!lead.name || !lead.company || !lead.role || !EMAIL.test(lead.email) || !lead.consent) {
    return NextResponse.json({ error: "Missing or invalid fields." }, { status: 400 });
  }
  try {
    let all: unknown[] = [];
    try {
      all = JSON.parse(await readFile(FILE, "utf-8"));
    } catch {
      /* first lead */
    }
    all.unshift(lead);
    await mkdir(path.dirname(FILE), { recursive: true });
    await writeFile(FILE, JSON.stringify(all, null, 2));
  } catch (error) {
    console.error("could not store bottleneck lead", error);
    return NextResponse.json({ error: "Could not save." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
