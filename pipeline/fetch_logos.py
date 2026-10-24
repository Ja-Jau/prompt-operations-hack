"""Download company logos into public/logos/ so the demo never depends on a live logo service.

Source: logo.dev when LOGO_DEV_TOKEN is set (sharp logos, free tier), otherwise Google's
favicon service (works without a key, but some logos come out small or blurry).

For the best result, drop an official logo from the company's press kit into
public/logos/<id>.svg; build.py prefers .svg over downloaded .png files.

Usage:
  python pipeline/fetch_logos.py           # download missing logos
  python pipeline/fetch_logos.py --force   # re-download all
  python pipeline/build.py --no-ai         # then link the logos into the game data
"""

from __future__ import annotations

import argparse
import csv
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "pipeline" / "data" / "companies.csv"
LOGO_DIR = ROOT / "public" / "logos"

# Anything smaller is a placeholder icon, not a real logo.
MIN_BYTES = 500


def logo_url(domain: str) -> str:
    token = os.environ.get("LOGO_DEV_TOKEN")
    if token:
        return f"https://img.logo.dev/{urllib.parse.quote(domain)}?token={token}&size=256&format=png"
    return f"https://www.google.com/s2/favicons?domain={urllib.parse.quote(domain)}&sz=256"


def download(url: str) -> bytes | None:
    request = urllib.request.Request(url, headers={"User-Agent": "tehokas-logo-fetcher"})
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            if not response.headers.get("Content-Type", "").startswith("image/"):
                return None
            data = response.read()
    except OSError:
        return None
    return data if len(data) >= MIN_BYTES else None


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--force", action="store_true", help="re-download logos that already exist")
    args = parser.parse_args()

    LOGO_DIR.mkdir(parents=True, exist_ok=True)
    source = "logo.dev" if os.environ.get("LOGO_DEV_TOKEN") else "Google favicons (set LOGO_DEV_TOKEN for sharper logos)"
    print(f"Fetching logos from {source}")

    with CSV_PATH.open(encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))

    failed = []
    for row in rows:
        company_id, domain = row["id"], (row.get("domain") or "").strip()
        if not domain:
            failed.append(f"{company_id} (no domain)")
            continue
        target = LOGO_DIR / f"{company_id}.png"
        if target.exists() and not args.force:
            print(f"  {company_id}: already have it")
            continue
        data = download(logo_url(domain))
        if data is None:
            failed.append(company_id)
            print(f"  {company_id}: failed")
            continue
        target.write_bytes(data)
        print(f"  {company_id}: saved ({len(data) // 1024} KB)")

    if failed:
        print("No logo for:", ", ".join(failed), "- the game shows initials for these.")


if __name__ == "__main__":
    main()
