"""Download one fitting background photo per Higher or lower company.

pipeline/data/company_photos.json maps a company id to a reviewed Wikimedia Commons
file (a cell tower for Nokia, a refinery for Neste, a forest harvester for Ponsse).
Each photo is saved to public/images/company/<id>.jpg, its credit to
public/images/credits.json, and both are linked in pipeline/data/company_catalog.json.

Usage:
  python pipeline/fetch_company_photos.py          # missing photos only
  python pipeline/fetch_company_photos.py --force  # re-download everything
  npm run data:build                               # then export the game data
"""
from __future__ import annotations

import argparse
import io
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PHOTOS_PATH = ROOT / "pipeline/data/company_photos.json"
CATALOG_PATH = ROOT / "pipeline/data/company_catalog.json"
CREDITS_PATH = ROOT / "public/images/credits.json"
PHOTO_DIR = ROOT / "public/images/company"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
USER_AGENT = "FirmleHackathonPrototype/0.1 (Python urllib)"
FREE_LICENSES = ("cc by", "cc-by", "cc0", "public domain")
MAX_WIDTH = 1600
# Wikimedia answers 429 Too Many Requests when calls come back-to-back.
PAUSES_S = (3, 15, 45)


def get(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    for pause in PAUSES_S:
        time.sleep(pause)
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return response.read()
        except urllib.error.HTTPError as exc:
            if exc.code != 429:
                raise
    raise OSError("Rate limited by Wikimedia Commons; try again later")


def photo(title: str) -> tuple[bytes, dict]:
    params = urllib.parse.urlencode({"action": "query", "format": "json", "titles": title, "prop": "imageinfo",
                                     "iiprop": "url|extmetadata", "iiurlwidth": MAX_WIDTH})
    page = next(iter(json.loads(get(f"{COMMONS_API}?{params}"))["query"]["pages"].values()))
    if "imageinfo" not in page:
        raise ValueError(f"No such file: {title}")
    info = page["imageinfo"][0]
    meta = info.get("extmetadata", {})
    license_name = meta.get("LicenseShortName", {}).get("value", "")
    if not license_name.lower().startswith(FREE_LICENSES):
        raise ValueError(f"Not freely licensed: {license_name}")
    author = re.sub(r"<[^>]+>", "", meta.get("Artist", {}).get("value", "")).strip()
    if not author or author.startswith("Unknown author"):
        author = "Unknown"
    credit = {"author": author[:60], "url": info["descriptionurl"], "source": "Wikimedia Commons", "license": license_name}
    return get(info.get("thumburl") or info["url"]), credit


def save_jpeg(data: bytes, target: Path) -> None:
    """Commons may hand back a PNG or a larger size bucket; the game wants a light JPEG."""
    image = Image.open(io.BytesIO(data)).convert("RGB")
    if image.width > MAX_WIDTH:
        image = image.resize((MAX_WIDTH, round(image.height * MAX_WIDTH / image.width)), Image.LANCZOS)
    image.save(target, "JPEG", quality=80, optimize=True, progressive=True)


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--force", action="store_true", help="re-download photos that already exist")
    args = parser.parse_args()

    photos = {k: v for k, v in json.loads(PHOTOS_PATH.read_text(encoding="utf-8")).items() if not k.startswith("_")}
    credits = json.loads(CREDITS_PATH.read_text(encoding="utf-8"))
    credits.setdefault("companies", {})
    PHOTO_DIR.mkdir(parents=True, exist_ok=True)

    for cid, title in photos.items():
        target = PHOTO_DIR / f"{cid}.jpg"
        if target.exists() and cid in credits["companies"] and not args.force:
            continue
        print(f"{cid}: {title}", flush=True)
        try:
            data, credit = photo(title)
            save_jpeg(data, target)
        except (OSError, ValueError, KeyError) as exc:
            print(f"  failed: {exc}", flush=True)
            continue
        credits["companies"][cid] = credit
        # Checkpoint, so an interrupted run keeps what it downloaded.
        CREDITS_PATH.write_text(json.dumps(credits, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"  saved, photo by {credit['author']}", flush=True)

    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    linked = 0
    for company in catalog:
        cid = company["id"]
        if cid in photos and cid in credits["companies"] and (PHOTO_DIR / f"{cid}.jpg").exists():
            company["image"] = f"/images/company/{cid}.jpg"
            company["imageCredit"] = credits["companies"][cid]
            linked += 1
    CATALOG_PATH.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Linked {linked} photos. Now run: npm run data:build")


if __name__ == "__main__":
    main()
