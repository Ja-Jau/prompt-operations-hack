import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { addLead } from "@/lib/leads";

const MAX_FIELD = 120;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function field(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, MAX_FIELD) : "";
}

/** POST { name, email, company, source, contextCompanyId } from the game or a brief. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const lead = {
    id: randomUUID(),
    name: field(body?.name),
    email: field(body?.email),
    company: field(body?.company),
    source: field(body?.source) || "unknown",
    contextCompanyId: field(body?.contextCompanyId) || null,
    createdAt: new Date().toISOString(),
  };

  if (!lead.name || !lead.company || !EMAIL.test(lead.email)) {
    return NextResponse.json({ error: "Please add your name, company and a valid email." }, { status: 400 });
  }

  try {
    await addLead(lead);
  } catch (error) {
    console.error("could not store lead", error);
    return NextResponse.json({ error: "Could not save right now. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
