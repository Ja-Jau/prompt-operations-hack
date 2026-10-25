import "server-only";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { mkdir, open, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { getHiringCompanies } from "@/lib/data/companies";
import type { HiringCompany } from "@/types/company";

type Sample = { companyId: string; companyName: string; title: string; quote: string; url: string; location: string; category: string; fetchedAt: string };
type Snapshot = { ads: Sample[]; updatedAt: string; runs: number };
const file = path.join(process.cwd(), ".data", "dashboard-job-ads.json");
const lockFile = `${file}.lock`;
const exec = promisify(execFile);

async function snapshot(): Promise<Snapshot> {
  try { return JSON.parse(await readFile(file, "utf8")); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { ads: [], updatedAt: "", runs: 0 };
    throw error;
  }
}

/** Runtime dashboard overlay; bundled Firmle and higher/lower snapshots remain unchanged. */
export async function getDashboardCompanies(): Promise<{ companies: HiringCompany[]; updatedAt: string }> {
  const baseline = await getHiringCompanies();
  const state = await snapshot();
  const companies = new Map(baseline.map((company) => [company.id, company]));
  const groups = new Map<string, Sample[]>();
  for (const ad of state.ads) groups.set(ad.companyId, [...(groups.get(ad.companyId) ?? []), ad]);
  for (const [id, samples] of groups) {
    const old = companies.get(id);
    const name = samples[0].companyName;
    const ads = samples.filter((sample) => sample.quote).map((sample) => ({ title: sample.title, titleEn: sample.title, quote: sample.quote, quoteEn: sample.quote, url: sample.url }));
    const company: HiringCompany = {
      ...(old ?? { id, name, domain: null, brandColor: "#3b5379", logo: null, image: null, imageCredit: null, gameCompanyId: null }),
      locations: [...new Set(samples.map((sample) => sample.location).filter(Boolean))],
      functions: [...new Set(samples.map((sample) => sample.category))],
      titles: [...new Set(samples.map((sample) => sample.title))], titlesEn: [...new Set(samples.map((sample) => sample.title))],
      jobAds: { checked: samples.length, manual: ads.length, ads, source: "Current Jobly ads · explicit repetitive-task patterns (automatically flagged)", fetchedAt: samples.map((sample) => sample.fetchedAt).sort().at(-1)!.slice(0, 10) },
      velhoCase: null, funHint: null,
    };
    companies.set(id, company);
  }
  return { companies: [...companies.values()], updatedAt: state.updatedAt };
}

export async function refreshDashboardJobs(): Promise<{ checked: number; flagged: number }> {
  await mkdir(path.dirname(file), { recursive: true });
  // A stale lock can remain if the server was interrupted. Jobs time out after three minutes.
  try { if (Date.now() - (await stat(lockFile)).mtimeMs > 240_000) await unlink(lockFile); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  let lock;
  try { lock = await open(lockFile, "wx"); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error("A job-ad refresh is already running. Try again shortly.");
    throw error;
  }
  try {
    const previous = await snapshot();
    let stdout: string;
    try {
      ({ stdout } = await exec(process.env.DASHBOARD_PYTHON ?? (existsSync(path.join(process.cwd(), ".venv/bin/python")) ? path.join(process.cwd(), ".venv/bin/python") : "python3"), [path.join(process.cwd(), "pipeline", "refresh_dashboard_jobs.py"), String(previous.runs)], { timeout: 180_000, maxBuffer: 1024 * 1024 }));
    } catch (error) {
      console.error("Dashboard job-ad fetch failed", error instanceof Error ? error.message : "unknown error");
      throw new Error("Job-ad fetch failed. Check Python and scraper dependencies, source access, and the server log. Existing data was kept.");
    }
    const result = JSON.parse(stdout) as { ads: Sample[] };
    if (!Array.isArray(result.ads) || !result.ads.length) throw new Error("No readable job ads found. Existing data was kept.");
    const merged = new Map(previous.ads.map((ad) => [ad.url, ad]));
    for (const ad of result.ads) merged.set(ad.url, ad);
    const next: Snapshot = { ads: [...merged.values()], updatedAt: new Date().toISOString(), runs: previous.runs + 1 };
    await writeFile(`${file}.tmp`, JSON.stringify(next, null, 2));
    await rename(`${file}.tmp`, file);
    return { checked: result.ads.length, flagged: result.ads.filter((ad) => ad.quote).length };
  } finally { await lock.close(); await unlink(lockFile); }
}
