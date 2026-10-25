import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * The outreach log records what the dashboard *would* have sent.
 *
 * DEMO ONLY. Nothing in this module, or anywhere else in src/lib/outreach, opens an SMTP
 * connection, calls a mail API or imports a mail library. "Sending" means appending a row here
 * with `simulated: true`, so the demo can show the flow end to end without a single real email.
 */

export type OutreachEntry = {
  id: string;
  companyId: string;
  companyName: string;
  to: string;
  subject: string;
  /** Always true. Kept in the record so nobody can mistake a demo row for a real send. */
  simulated: true;
  /** What a real integration would do here, for the reviewer. */
  wouldHave: string;
  createdAt: string;
};

const LOG_FILE = path.join(process.cwd(), ".data", "outreach-log.json");

export async function readOutreachLog(): Promise<OutreachEntry[]> {
  try {
    return JSON.parse(await readFile(LOG_FILE, "utf-8")) as OutreachEntry[];
  } catch {
    return [];
  }
}

export async function appendOutreachLog(entries: OutreachEntry[]): Promise<void> {
  const log = await readOutreachLog();
  log.unshift(...entries);
  await mkdir(path.dirname(LOG_FILE), { recursive: true });
  await writeFile(LOG_FILE, JSON.stringify(log, null, 2));
}
