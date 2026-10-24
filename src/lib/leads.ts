import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Lead } from "@/types/company";

/**
 * Leads are stored in a local JSON file. That works for `npm run dev`, `npm start` and the
 * live demo on a laptop. Vercel's filesystem is read-only, so for a hosted version swap
 * these two functions for a KV store or a Google Sheet; nothing else needs to change.
 */
const LEADS_FILE = path.join(process.cwd(), ".data", "leads.json");

export async function readLeads(): Promise<Lead[]> {
  try {
    return JSON.parse(await readFile(LEADS_FILE, "utf-8")) as Lead[];
  } catch {
    return [];
  }
}

export async function addLead(lead: Lead): Promise<void> {
  const leads = await readLeads();
  leads.unshift(lead);
  await mkdir(path.dirname(LEADS_FILE), { recursive: true });
  await writeFile(LEADS_FILE, JSON.stringify(leads, null, 2));
}
