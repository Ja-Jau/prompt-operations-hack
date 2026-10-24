"""Write Velho's take on each daily case with Claude.

A company becomes a "Who's hiring for this?" case once it has at least MIN_QUOTES manual-work
quotes in pipeline/data/job_ads.json. For each case Claude writes, from those quotes only:
  - analystHint: the "Ask Velho" lifeline, a pattern an analyst would spot across the ads
  - fixOptions / correctIndex / fixReasoning: the "what would you fix first?" bonus round
  - adoptNote: how Velho would make sure people actually use the fix

Output: pipeline/data/velho_cases.json, merged into the game data by build.py.

Usage:
  python pipeline/build_cases.py            # cases without Velho's take yet
  python pipeline/build_cases.py --force    # rewrite all
  python pipeline/build.py --no-ai

Needs Anthropic credentials (ANTHROPIC_API_KEY or `ant auth login`).
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

import anthropic

ROOT = Path(__file__).resolve().parent.parent
COMPANIES_CSV = ROOT / "pipeline" / "data" / "companies.csv"
JOB_ADS_PATH = ROOT / "pipeline" / "data" / "job_ads.json"
OUT_PATH = ROOT / "pipeline" / "data" / "velho_cases.json"

MODEL = "claude-opus-5-5"
MIN_QUOTES = 3  # keep in sync with MIN_CASE_QUOTES in src/lib/case/cases.ts
FIX_OPTIONS = 3
# Velho's service areas, as listed under "Where we help" on velho.io (src/lib/velho.ts).
SERVICE_AREAS = [
    "Customer follow-up",
    "Quotes and order intake",
    "Field reporting",
    "Scheduling and dispatch",
    "Management reporting",
    "Robotics and physical automation",
]

SYSTEM = """You are an analyst at Velho, a Finnish AI growth partner. Velho finds the manual
work that slows a company down, builds the fix, and makes sure people actually use it.

You get one company and verbatim quotes from its currently open job ads that describe manual
work. Write Velho's take for a daily guessing game. Base everything only on the quotes; do
not invent facts about the company. Be concrete, neutral and respectful: this is an
opportunity, not criticism.

- analystHint: max 20 words. A pattern across the ads that an analyst would spot, e.g. the
  same data being typed into several systems. Never name the company or its brands.
- fixOptions: exactly 3 short options (max 8 words each) for what to automate first. One is
  clearly the best first fix based on the quotes; the other two are plausible but weaker.
- correctIndex: index (0-2) of the best option.
- fixReasoning: max 35 words. Why that is the right first fix.
- adoptNote: max 20 words. How Velho would make sure the people doing this work today
  actually adopt the fix.
- serviceArea: which of Velho's service areas the best first fix belongs to."""

CASE_SCHEMA = {
    "type": "object",
    "properties": {
        "analystHint": {"type": "string"},
        "fixOptions": {"type": "array", "items": {"type": "string"}},
        "correctIndex": {"type": "integer"},
        "fixReasoning": {"type": "string"},
        "adoptNote": {"type": "string"},
        "serviceArea": {"type": "string", "enum": SERVICE_AREAS},
    },
    "required": ["analystHint", "fixOptions", "correctIndex", "fixReasoning", "adoptNote", "serviceArea"],
    "additionalProperties": False,
}


def write_case(client: anthropic.Anthropic, company: dict, ads: list[dict]) -> dict | None:
    quotes = "\n".join(f'- {ad["title"]}: "{ad["quote"]}"' for ad in ads)
    prompt = f"Company: {company['name']} ({company['industry']}, {company['employees']} employees)\n\nQuotes:\n{quotes}"
    response = client.beta.messages.create(
        model=MODEL,
        max_tokens=4096,
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
        output_config={"effort": "medium", "format": {"type": "json_schema", "schema": CASE_SCHEMA}},
        system=SYSTEM,
        messages=[{"role": "user", "content": prompt}],
    )
    if response.stop_reason != "end_turn":
        print(f"    stopped with '{response.stop_reason}'")
        return None
    case = json.loads(next(b.text for b in response.content if b.type == "text"))
    if len(case["fixOptions"]) != FIX_OPTIONS or not 0 <= case["correctIndex"] < FIX_OPTIONS:
        print("    malformed fix options, skipped")
        return None
    return case


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--force", action="store_true", help="rewrite cases that already exist")
    args = parser.parse_args()

    if not JOB_ADS_PATH.exists():
        sys.exit("No job-ad data yet. Run pipeline/fetch_job_ads.py first.")
    job_ads = json.loads(JOB_ADS_PATH.read_text(encoding="utf-8"))
    cases = json.loads(OUT_PATH.read_text(encoding="utf-8")) if OUT_PATH.exists() else {}
    with COMPANIES_CSV.open(encoding="utf-8", newline="") as f:
        companies = {row["id"]: row for row in csv.DictReader(f)}

    client = anthropic.Anthropic()
    for company_id, data in job_ads.items():
        ads = data.get("ads", [])
        if company_id not in companies or len(ads) < MIN_QUOTES:
            continue
        if company_id in cases and not args.force:
            print(f"  {company_id}: already written")
            continue
        print(f"  {company_id}: writing Velho's take from {len(ads)} quotes…")
        try:
            case = write_case(client, companies[company_id], ads)
        except anthropic.APIError as exc:
            print(f"    API error: {exc}")
            continue
        if case:
            cases[company_id] = case
            OUT_PATH.write_text(json.dumps(cases, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    eligible = sum(1 for d in job_ads.values() if len(d.get("ads", [])) >= MIN_QUOTES)
    print(f"{eligible} companies qualify as daily cases. Now run: python pipeline/build.py --no-ai")


if __name__ == "__main__":
    main()
