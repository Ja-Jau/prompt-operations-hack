"""Validate data/jobs_raw.json (or jobs.json) and data/game_rounds.json. Prints a summary report.

Usage: python validate.py [--jobs data/jobs.json]
Checks: required fields, duplicates, PII patterns, score ranges, allowed industries,
and (if game_rounds.json exists) that anonymised text doesn't leak the company name.
"""
import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

DATA = Path(__file__).resolve().parent / "data"
REQUIRED = ["id", "source", "url", "scraped_at", "company_name", "job_title", "location", "description_raw"]
INDUSTRIES = {"Manufacturing", "Retail", "Logistics & Transport", "Construction", "Healthcare",
              "Finance & Insurance", "Energy", "Food & Beverage", "IT & Services", "Public sector",
              "Education", "Real Estate", "Hospitality", "Professional services", "Other"}
EMAIL = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
PHONE = re.compile(r"(?<!\d)(?:\+|00)?\d[\d\s().-]{8,}\d")
LEGAL = re.compile(r"\b(oyj|oy|ab|ltd|inc|gmbh|abp|ry|as)\b\.?", re.I)


def name_tokens(company: str) -> list[str]:
    base = LEGAL.sub("", company)
    toks = [t for t in re.split(r"[\s\-–,/&]+", base) if len(t) >= 4]
    return [base.strip()] + toks if base.strip() else toks


def check_jobs(jobs: list[dict], errs: list[str]):
    seen_id, seen_url = set(), set()
    for j in jobs:
        tag = f"{j.get('id')}/{j.get('company_name')}"
        for f in REQUIRED:
            if not j.get(f):
                errs.append(f"missing {f}: {tag}")
        if j.get("id") in seen_id or j.get("url") in seen_url:
            errs.append(f"duplicate: {tag}")
        seen_id.add(j.get("id"))
        seen_url.add(j.get("url"))
        text = " ".join(str(j.get(k, "")) for k in ("description_raw", "description_en"))
        if EMAIL.search(text):
            errs.append(f"email in text: {tag}")
        if PHONE.search(text):
            errs.append(f"phone-like number in text: {tag}")
        if "ai_opportunity_score" in j and not (1 <= j["ai_opportunity_score"] <= 10):
            errs.append(f"score out of range: {tag}")
        if "industry" in j and j["industry"] not in INDUSTRIES:
            errs.append(f"industry not allowed ({j['industry']}): {tag}")


def check_rounds(path: Path, errs: list[str]):
    rounds = json.loads(path.read_text())
    for r in rounds.get("guess_who", []):
        text = r["description"] + " " + r.get("title", "")
        for tok in name_tokens(r["correct_company"]):
            if re.search(re.escape(tok), text, re.I):
                errs.append(f"leak '{tok}' in guess_who {r.get('id')}")
        if r["correct_company"] not in r["options"] or len(set(r["options"])) < 4:
            errs.append(f"bad options in guess_who {r.get('id')}")
    for r in rounds.get("higher_lower", []):
        if r["metric"] == "ai_opportunity_score" and abs(r["a"]["value"] - r["b"]["value"]) < 2:
            errs.append(f"near-tie in higher_lower {r.get('id')}")
        if r["a"]["value"] == r["b"]["value"]:
            errs.append(f"tie in higher_lower {r.get('id')}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--jobs", default=str(DATA / "jobs_raw.json"))
    a = ap.parse_args()
    jobs = json.loads(Path(a.jobs).read_text())
    errs: list[str] = []
    check_jobs(jobs, errs)
    rounds_path = DATA / "game_rounds.json"
    if rounds_path.exists():
        check_rounds(rounds_path, errs)

    print(f"jobs: {len(jobs)} | companies: {len({j['company_name'] for j in jobs})}")
    print("top companies:", Counter(j["company_name"] for j in jobs).most_common(5))
    print("site categories:", dict(Counter(j.get("site_category") for j in jobs)))
    for k in ("industry", "role_category"):
        if any(k in j for j in jobs):
            print(f"{k}:", dict(Counter(j.get(k) for j in jobs)))
    print(f"with description_en: {sum(bool(j.get('description_en')) for j in jobs)}")
    print(f"\n{len(errs)} problem(s)")
    for e in errs[:40]:
        print(" -", e)
    sys.exit(1 if errs else 0)


if __name__ == "__main__":
    main()
