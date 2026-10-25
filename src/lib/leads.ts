import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Lead } from "@/types/company";

/**
 * Leads go to Upstash Redis when it's connected (Vercel → Storage → Upstash adds the env vars),
 * otherwise to a local JSON file. The file works for `npm run dev` and a demo on a laptop, but
 * not on Vercel, whose file system is read-only.
 */
const LEADS_FILE = path.join(process.cwd(), ".data", "leads.json");
const LEADS_KEY = "leads";

const REDIS_URL = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

/** One Redis command over Upstash's REST API, so no client package is needed. */
async function redis<T>(command: (string | number)[]): Promise<T> {
  const response = await fetch(REDIS_URL!, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Redis ${command[0]} failed: ${response.status}`);
  return ((await response.json()) as { result: T }).result;
}

export async function readLeads(): Promise<Lead[]> {
  try {
    if (REDIS_URL && REDIS_TOKEN) {
      const rows = await redis<string[]>(["LRANGE", LEADS_KEY, 0, -1]);
      return rows.map((row) => JSON.parse(row) as Lead);
    }
    return JSON.parse(await readFile(LEADS_FILE, "utf-8")) as Lead[];
  } catch {
    return [];
  }
}

export async function addLead(lead: Lead): Promise<void> {
  if (REDIS_URL && REDIS_TOKEN) {
    // Newest first, like the file.
    await redis(["LPUSH", LEADS_KEY, JSON.stringify(lead)]);
    return;
  }
  const leads = await readLeads();
  leads.unshift(lead);
  await mkdir(path.dirname(LEADS_FILE), { recursive: true });
  await writeFile(LEADS_FILE, JSON.stringify(leads, null, 2));
}
