import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isDashboardAuthenticated } from "@/lib/dashboard/auth";
import { appendOutreachLog, readOutreachLog, type OutreachEntry } from "@/lib/outreach/log";

/**
 * DEMO ENDPOINT. Simulates sending the outreach emails.
 *
 * It does NOT send email. There is no SMTP client, no mail API key and no mail library anywhere
 * in this project. A "send" validates the drafts, waits a moment so the UI can show progress, and
 * appends rows marked `simulated: true` to .data/outreach-log.json. The response says so too.
 */

const MAX_BATCH = 50;
const MAX_FIELD = 300;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type DraftInput = { companyId: string; companyName: string; to: string; subject: string };

function field(value: unknown, max = MAX_FIELD): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function GET() {
  if (!(await isDashboardAuthenticated())) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  return NextResponse.json({ simulated: true, entries: await readOutreachLog() });
}

export async function POST(request: Request) {
  if (!(await isDashboardAuthenticated())) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const drafts: unknown[] = Array.isArray(body?.drafts) ? body.drafts : [];

  if (drafts.length === 0 || drafts.length > MAX_BATCH) {
    return NextResponse.json({ error: `Send between 1 and ${MAX_BATCH} drafts.` }, { status: 400 });
  }

  const now = new Date().toISOString();
  const entries: OutreachEntry[] = [];
  for (const raw of drafts as Partial<DraftInput>[]) {
    const to = field(raw?.to);
    const subject = field(raw?.subject);
    const companyId = field(raw?.companyId, 80);
    const companyName = field(raw?.companyName, 120);
    if (!companyId || !companyName || !subject || !EMAIL.test(to)) {
      return NextResponse.json({ error: `Draft for ${companyName || "a company"} is missing an address or subject.` }, { status: 400 });
    }
    entries.push({
      id: randomUUID(),
      companyId,
      companyName,
      to,
      subject,
      simulated: true,
      wouldHave: `A real integration would hand this draft to a person at Velho for approval, then send it from hello@velho.io. This demo did neither.`,
      createdAt: now,
    });
  }

  // A short pause so the dashboard can show the batch progressing, like a real queue would.
  await new Promise((resolve) => setTimeout(resolve, 400 + Math.min(entries.length, 10) * 120));

  try {
    await appendOutreachLog(entries);
  } catch (error) {
    console.error("could not write outreach log", error);
    return NextResponse.json({ error: "Could not record the demo send. Nothing was sent either way." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    simulated: true,
    sent: 0,
    queuedForDemo: entries.length,
    message: `${entries.length} ${entries.length === 1 ? "email" : "emails"} recorded as a demo. No email was sent.`,
    entries,
  });
}
