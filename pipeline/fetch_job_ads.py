"""Measure how much of each company's open job ads describe manual work, using Claude.

For every company in companies.csv, Claude uses web search + web fetch (which respect each
site's robots.txt) to read up to MAX_ADS currently open job ads from that company, then
reports which ones describe manual, repetitive work (Excel upkeep, typing data between
systems, "käsin", manual reporting, ...), each with a verbatim quote and the ad's URL.

The game's Velho rounds compare the share of manual-work ads. Output:
pipeline/data/job_ads.json, merged into the game data by build.py.

Usage:
  python pipeline/fetch_job_ads.py            # all companies without data yet
  python pipeline/fetch_job_ads.py --force    # re-check every company
  python pipeline/build.py --no-ai

Needs Anthropic credentials (ANTHROPIC_API_KEY or `ant auth login`).
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from datetime import date
from pathlib import Path

import anthropic

ROOT = Path(__file__).resolve().parent.parent
COMPANIES_CSV = ROOT / "pipeline" / "data" / "companies.csv"
OUT_PATH = ROOT / "pipeline" / "data" / "job_ads.json"

MODEL = "claude-opus-5-5"
MAX_ADS = 10
MAX_TURNS = 6

SYSTEM = f"""You research open job ads for a game about manual work in Finnish companies.

The user message names a company and its website. Find up to {MAX_ADS} job ads that this
company itself has open right now in Finland: check its careers site first, then public
job boards such as Työmarkkinatori. Read each ad's description with web fetch.

For every ad you read, decide whether it describes manual, repetitive work that software
could take over: keeping Excel sheets up to date, typing or copying data between systems,
manual reporting or reconciliations, paper forms, doing something "käsin" or "manuaalisesti".
Normal skills lists ("Excel skills an advantage") do not count on their own; the ad must
describe the work itself.

Then call report_job_ads exactly once. For ads that describe manual work, `quote` must be a
short verbatim phrase (max 25 words) from the ad that shows it; otherwise use an empty string.
Only include ads you actually read. If you find no open ads, report an empty list."""

REPORT_TOOL = {
    "name": "report_job_ads",
    "description": "Report the job ads you read and whether each describes manual work.",
    "strict": True,
    "input_schema": {
        "type": "object",
        "properties": {
            "ads": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "url": {"type": "string"},
                        "describesManualWork": {"type": "boolean"},
                        "quote": {"type": "string"},
                    },
                    "required": ["title", "url", "describesManualWork", "quote"],
                    "additionalProperties": False,
                },
            }
        },
        "required": ["ads"],
        "additionalProperties": False,
    },
}


def check_company(client: anthropic.Anthropic, name: str, domain: str) -> list[dict] | None:
    messages = [{"role": "user", "content": f"{name} ({domain})"}]
    for _ in range(MAX_TURNS):
        response = client.beta.messages.create(
            model=MODEL,
            max_tokens=16000,
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            output_config={"effort": "medium"},
            system=SYSTEM,
            tools=[
                {"type": "web_search_20260209", "name": "web_search", "max_uses": 5},
                {"type": "web_fetch_20260209", "name": "web_fetch", "max_uses": MAX_ADS + 3},
                REPORT_TOOL,
            ],
            messages=messages,
        )
        for block in response.content:
            if block.type == "tool_use" and block.name == "report_job_ads":
                return block.input["ads"]
        # A long research turn can pause; send it back to let Claude continue.
        if response.stop_reason == "pause_turn":
            messages.append({"role": "assistant", "content": response.content})
            continue
        print(f"    stopped with '{response.stop_reason}' before reporting")
        return None
    return None


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--force", action="store_true", help="re-check companies that already have data")
    args = parser.parse_args()

    results = json.loads(OUT_PATH.read_text(encoding="utf-8")) if OUT_PATH.exists() else {}
    with COMPANIES_CSV.open(encoding="utf-8", newline="") as f:
        companies = list(csv.DictReader(f))

    client = anthropic.Anthropic()
    for row in companies:
        company_id = row["id"]
        if company_id in results and not args.force:
            print(f"  {company_id}: already checked")
            continue
        print(f"  {company_id}: reading job ads…")
        try:
            ads = check_company(client, row["name"], row.get("domain") or row["name"])
        except anthropic.APIError as exc:
            print(f"    API error: {exc}")
            continue
        if ads is None:
            continue

        manual_ads = [ad for ad in ads if ad["describesManualWork"] and ad["quote"]]
        results[company_id] = {
            "checked": len(ads),
            "manual": len(manual_ads),
            # Every manual-work quote: the daily case reveals them one by one as clues.
            "ads": [{"title": ad["title"], "quote": ad["quote"], "url": ad["url"]} for ad in manual_ads],
            "source": "Open job ads read by Claude",
            "fetchedAt": date.today().isoformat(),
        }
        print(f"    {len(manual_ads)} of {len(ads)} open ads describe manual work")
        # Save after every company so an interruption loses nothing.
        OUT_PATH.write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print("Done. Now run: python pipeline/build.py --no-ai")


if __name__ == "__main__":
    main()
