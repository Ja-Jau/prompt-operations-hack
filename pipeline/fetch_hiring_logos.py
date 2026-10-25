"""Download a logo for every company in Who's hiring? into public/logos/<id>.png.

Input:  pipeline/data/company_domains.json   candidate websites per company id, tried in order
Output: public/logos/<id>.png                picked up by import_jobs.py and CompanyLogo

For each website it tries Google's favicon service (or logo.dev when LOGO_DEV_TOKEN is set),
DuckDuckGo's icon service and the site's own apple-touch-icon and favicon, and keeps the sharpest image.

Usage:
  python pipeline/fetch_hiring_logos.py           # download missing or blurry logos
  python pipeline/fetch_hiring_logos.py --force   # re-download all
  python pipeline/import_jobs.py                  # then link them into the game data
"""

from __future__ import annotations

import argparse
import io
import json
import sys
from pathlib import Path

from PIL import Image

from fetch_logos import LOGO_DIR, download, logo_url

ROOT = Path(__file__).resolve().parent.parent
DOMAINS_PATH = ROOT / "pipeline" / "data" / "company_domains.json"
HIRING_JSON = ROOT / "src" / "data" / "hiring.json"

# Logos at least this wide are kept as they are; smaller ones look blurry on the cards.
GOOD_WIDTH = 128


def sources(domain: str) -> list[str]:
    return [
        logo_url(domain),
        f"https://{domain}/apple-touch-icon.png",
        f"https://www.{domain}/apple-touch-icon.png",
        f"https://icons.duckduckgo.com/ip3/{domain}.ico",
        f"https://{domain}/favicon.ico",
    ]


def best_logo(domains: list[str]) -> tuple[Image.Image, str] | None:
    """The widest image any source has for any of the company's websites."""
    best: tuple[Image.Image, str] | None = None
    for domain in domains:
        for url in sources(domain):
            # Pillow checks it's a real image, so small simple icons can pass.
            data = download(url, min_bytes=1)
            if not data:
                continue
            try:
                image = Image.open(io.BytesIO(data))
                image.load()
            except Exception:
                continue
            if best is None or image.width > best[0].width:
                best = (image, domain)
            if best[0].width >= GOOD_WIDTH:
                return best
    return best


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--force", action="store_true", help="re-download logos that already exist")
    args = parser.parse_args()

    domains = json.loads(DOMAINS_PATH.read_text(encoding="utf-8"))
    ids = [c["id"] for c in json.loads(HIRING_JSON.read_text(encoding="utf-8"))]
    LOGO_DIR.mkdir(parents=True, exist_ok=True)

    failed = []
    for company_id in ids:
        target = LOGO_DIR / f"{company_id}.png"
        if target.exists() and not args.force and Image.open(target).width >= GOOD_WIDTH:
            continue
        found = best_logo(domains.get(company_id, []))
        if found is None:
            failed.append(company_id)
            continue
        image, domain = found
        if target.exists() and Image.open(target).width >= image.width and not args.force:
            continue
        image.convert("RGBA").save(target, "PNG")
        print(f"  {company_id}: {domain} ({image.width}px)")

    if failed:
        print("No logo for:", ", ".join(failed), "- the game shows initials for these.")


if __name__ == "__main__":
    main()
