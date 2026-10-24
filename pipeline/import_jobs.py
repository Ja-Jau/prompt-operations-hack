"""Turn the team's scraped job ads into the game's hiring data.

Input:  velho-game-data/data/jobs_raw.json      job ads scraped from Jobly.fi (velho-game-data/scraper)
        pipeline/data/curated_signals.json      quotes describing routine work software could take
                                                over, chosen per ad, plus Velho's take for each case
        pipeline/data/velho_cases.json          optional: Claude-written takes (build_cases.py) win
Output: src/data/hiring.json                    every hiring company with its quotes and take
        pipeline/data/job_ads.json              stats for companies also in Higher or lower

Every quote must appear word for word in the ad it cites ('…' marks a trimmed sentence);
the script stops if one doesn't, so nothing in the game can be invented.

Usage:
  python pipeline/import_jobs.py
  python pipeline/build.py --no-ai
"""

from __future__ import annotations

import json
import re
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
JOBS_PATH = ROOT / "velho-game-data" / "data" / "jobs_raw.json"
CURATED_PATH = ROOT / "pipeline" / "data" / "curated_signals.json"
VELHO_CASES_PATH = ROOT / "pipeline" / "data" / "velho_cases.json"
COMPANIES_JSON = ROOT / "src" / "data" / "companies.json"
HIRING_OUT = ROOT / "src" / "data" / "hiring.json"
JOB_ADS_OUT = ROOT / "pipeline" / "data" / "job_ads.json"
DOMAINS_PATH = ROOT / "pipeline" / "data" / "company_domains.json"
LOGO_DIR = ROOT / "public" / "logos"

SOURCE = "Open job ads on Jobly.fi"
MIN_CASE_QUOTES = 2  # keep in sync with MIN_CASE_QUOTES in src/lib/case/cases.ts
LEGAL = re.compile(r"\b(oyj|oy|ab|ltd|inc|gmbh|abp|ry|as)\b\.?", re.IGNORECASE)

FUNCTIONS_EN = {
    "Osto ja hankinta": "Procurement",
    "Talous ja rahoitus": "Finance",
    "Henkilöstöhallinto": "HR",
    "Hallinto- ja toimistotyö": "Office and admin",
    "Asiakaspalvelu": "Customer service",
    "Projektihallinto": "Project management",
    "Kuljetus ja logistiikka": "Logistics",
    "Myynti": "Sales",
}


def slugify(text: str) -> str:
    ascii_text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", ascii_text.lower()).strip("-")


def squash(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def check_verbatim(quote: str, description: str) -> bool:
    """Each part of the quote between '…' marks must appear in the ad as written."""
    text = squash(description)
    return all(part.strip() in text for part in quote.split("…") if part.strip())


def find_game_company(name: str, known: dict[str, dict]) -> dict | None:
    """The matching Higher or lower company, for its logo, domain and photo."""
    base = LEGAL.sub("", name).strip().casefold()
    return known.get(name.casefold()) or next((c for n, c in known.items() if n and base.startswith(n)), None)


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    jobs = json.loads(JOBS_PATH.read_text(encoding="utf-8"))
    curated = json.loads(CURATED_PATH.read_text(encoding="utf-8"))["companies"]
    claude_cases = json.loads(VELHO_CASES_PATH.read_text(encoding="utf-8")) if VELHO_CASES_PATH.exists() else {}
    known = {c["name"].casefold(): c for c in json.loads(COMPANIES_JSON.read_text(encoding="utf-8"))}
    jobs_by_id = {job["id"]: job for job in jobs}
    domains = json.loads(DOMAINS_PATH.read_text(encoding="utf-8")) if DOMAINS_PATH.exists() else {}

    by_company: dict[str, list[dict]] = defaultdict(list)
    for job in jobs:
        by_company[job["company_name"].strip()].append(job)

    errors = [f"curated company not in the scraped data: {name}" for name in curated if name not in by_company]

    hiring = []
    for name, company_jobs in sorted(by_company.items()):
        company_id = slugify(name)
        entry = curated.get(name, {})

        ads = []
        for q in entry.get("quotes", []):
            job = jobs_by_id.get(q["job"])
            if not job or job["company_name"].strip() != name:
                errors.append(f"{name}: job {q['job']} is not one of its ads")
                continue
            if not check_verbatim(q["quote"], job["description_raw"]):
                errors.append(f"{name}: quote not found word for word in job {q['job']}: {q['quote'][:60]}…")
                continue
            ads.append({"title": squash(job["job_title"]), "quote": q["quote"], "url": job["url"]})

        locations = sorted({loc.strip() for job in company_jobs for loc in (job.get("location") or "").split(",") if loc.strip()})
        functions = sorted({FUNCTIONS_EN.get(job.get("site_category"), job.get("site_category") or "Other") for job in company_jobs})
        match = find_game_company(name, known)
        velho_case = None
        if len(ads) >= MIN_CASE_QUOTES:
            velho_case = claude_cases.get(company_id) or entry.get("velhoCase")

        hiring.append(
            {
                "id": company_id,
                "name": name,
                "domain": match["domain"] if match else next(iter(domains.get(company_id, [])), None),
                "brandColor": match["brandColor"] if match else "#3b5379",
                "logo": (match and match["logo"]) or (f"/logos/{company_id}.png" if (LOGO_DIR / f"{company_id}.png").exists() else None),
                "image": match["image"] if match else None,
                "imageCredit": match["imageCredit"] if match else None,
                "locations": locations,
                "functions": functions,
                "titles": sorted({squash(job["job_title"]) for job in company_jobs}),
                "jobAds": {
                    "checked": len(company_jobs),
                    # Ads with at least one quote describing routine work.
                    "manual": len({a["url"] for a in ads}),
                    "ads": ads,
                    "source": SOURCE,
                    "fetchedAt": max(job.get("posted_date") or job["scraped_at"][:10] for job in company_jobs),
                },
                "velhoCase": velho_case,
                "gameCompanyId": match["id"] if match else None,
            }
        )

    if errors:
        print("Fix these before importing:", *errors, sep="\n  ", file=sys.stderr)
        sys.exit(1)

    HIRING_OUT.write_text(json.dumps(hiring, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # Stats for Higher or lower's Velho rounds, keyed by companies.csv id.
    job_ads = {h["gameCompanyId"]: h["jobAds"] for h in hiring if h["gameCompanyId"]}
    JOB_ADS_OUT.write_text(json.dumps(job_ads, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    cases = [h for h in hiring if h["velhoCase"]]
    signals = [h for h in hiring if h["jobAds"]["ads"]]
    print(f"{len(jobs)} ads from {len(hiring)} companies → {HIRING_OUT.relative_to(ROOT)}")
    print(f"{len(signals)} companies with verified quotes, {sum(len(h['jobAds']['ads']) for h in hiring)} quotes")
    print(f"{len(cases)} daily cases: {', '.join(h['name'] for h in cases)}")
    print(f"{len(job_ads)} also in Higher or lower: {', '.join(job_ads)}")
    print("Now run: python pipeline/build.py --no-ai")


if __name__ == "__main__":
    main()
