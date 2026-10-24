"""Download background photos into public/images/.

Two sets:
  - one photo per industry (pipeline/data/industries.csv) -> public/images/industry/<slug>.jpg,
    the fallback for any company without its own photo
  - one photo per company (`image_query` in companies.csv) -> public/images/<id>.jpg

Source: Unsplash when UNSPLASH_ACCESS_KEY is set (free at unsplash.com/developers),
otherwise Wikimedia Commons, which needs no key. Only freely licensed photos are used,
and every photo's credit is saved to public/images/credits.json and shown in the game.

Usage:
  python pipeline/fetch_images.py                    # industries + companies, missing only
  python pipeline/fetch_images.py --industries-only  # just the fallbacks (quick)
  python pipeline/fetch_images.py --force            # re-download everything
  python pipeline/build.py --no-ai                   # then link the photos into the game data
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
COMPANIES_CSV = ROOT / "pipeline" / "data" / "companies.csv"
INDUSTRIES_CSV = ROOT / "pipeline" / "data" / "industries.csv"
IMAGE_DIR = ROOT / "public" / "images"
INDUSTRY_DIR = IMAGE_DIR / "industry"
CREDITS_PATH = IMAGE_DIR / "credits.json"

USER_AGENT = "TehokasHackathonPrototype/0.1 (Python urllib)"
UNSPLASH_API = "https://api.unsplash.com"
UNSPLASH_UTM = "utm_source=tehokas&utm_medium=referral"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
MIN_WIDTH = 1200
# Wikimedia returns 429 Too Many Requests when downloads come back-to-back.
REQUEST_PAUSE_S = 3
FREE_LICENSES = ("cc by", "cc-by", "cc0", "public domain")


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def get(url: str, headers: dict[str, str] | None = None) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, **(headers or {})})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read()


def from_unsplash(query: str, key: str) -> tuple[bytes, dict] | None:
    auth = {"Authorization": f"Client-ID {key}", "Accept-Version": "v1"}
    params = urllib.parse.urlencode({"query": query, "per_page": 1, "content_filter": "high"})
    results = json.loads(get(f"{UNSPLASH_API}/search/photos?{params}", auth))["results"]
    if not results:
        return None
    photo = results[0]
    get(photo["links"]["download_location"], auth)  # Unsplash asks apps to report each use
    credit = {
        "author": photo["user"]["name"],
        "url": f"{photo['user']['links']['html']}?{UNSPLASH_UTM}",
        "source": "Unsplash",
        "license": None,
    }
    return get(photo["urls"]["regular"]), credit


def from_commons(query: str) -> tuple[bytes, dict] | None:
    params = urllib.parse.urlencode(
        {
            "action": "query",
            "format": "json",
            "generator": "search",
            "gsrsearch": f"{query} filetype:bitmap",
            "gsrnamespace": 6,
            "gsrlimit": 15,
            "prop": "imageinfo",
            "iiprop": "url|size|mime|extmetadata",
            "iiurlwidth": 1600,
        }
    )
    pages = json.loads(get(f"{COMMONS_API}?{params}")).get("query", {}).get("pages", {})
    for page in sorted(pages.values(), key=lambda p: p.get("index", 0)):
        info = (page.get("imageinfo") or [{}])[0]
        meta = info.get("extmetadata", {})
        license_name = meta.get("LicenseShortName", {}).get("value", "")
        if info.get("mime") != "image/jpeg" or info.get("width", 0) < MIN_WIDTH:
            continue
        if not license_name.lower().startswith(FREE_LICENSES):
            continue
        author = re.sub(r"<[^>]+>", "", meta.get("Artist", {}).get("value", "")).strip() or "Unknown"
        credit = {
            "author": author[:60],
            "url": info["descriptionurl"],
            "source": "Wikimedia Commons",
            "license": license_name,
        }
        return get(info.get("thumburl") or info["url"]), credit
    return None


def fetch(query: str, target: Path, unsplash_key: str | None) -> dict | None:
    try:
        found = from_unsplash(query, unsplash_key) if unsplash_key else from_commons(query)
    except OSError as exc:
        print(f"    failed: {exc}")
        return None
    if found is None:
        print(f"    no free photo found for '{query}'")
        return None
    data, credit = found
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    print(f"    saved, photo by {credit['author']} ({credit['source']})")
    return credit


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--force", action="store_true", help="re-download photos that already exist")
    parser.add_argument("--industries-only", action="store_true", help="only the per-industry fallbacks")
    args = parser.parse_args()

    key = os.environ.get("UNSPLASH_ACCESS_KEY")
    print(f"Source: {'Unsplash' if key else 'Wikimedia Commons (set UNSPLASH_ACCESS_KEY to use Unsplash)'}")

    credits = {"industries": {}, "companies": {}}
    if CREDITS_PATH.exists():
        credits.update(json.loads(CREDITS_PATH.read_text(encoding="utf-8")))

    jobs = [
        ("industries", slugify(r["industry"]), r["image_query"], INDUSTRY_DIR / f"{slugify(r['industry'])}.jpg")
        for r in read_csv(INDUSTRIES_CSV)
    ]
    if not args.industries_only:
        jobs += [
            ("companies", r["id"], r["image_query"], IMAGE_DIR / f"{r['id']}.jpg")
            for r in read_csv(COMPANIES_CSV)
            if (r.get("image_query") or "").strip()
        ]

    for group, name, query, target in jobs:
        print(f"  {'industry' if group == 'industries' else 'company'} {name}: '{query}'")
        if target.exists() and name in credits[group] and not args.force:
            print("    already have it")
            continue
        credit = fetch(query, target, key)
        if credit:
            credits[group][name] = credit
        time.sleep(REQUEST_PAUSE_S)

    CREDITS_PATH.write_text(json.dumps(credits, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Done. Now run: python pipeline/build.py --no-ai")


if __name__ == "__main__":
    main()
