"""Bounded dashboard refresh: one rotating Jobly category, up to ten ad pages with short-lived caching.

Print JSON only. Reuses the source parser and robots access checks; no AI key needed.
The app passes a category offset. Only explicit task descriptions are flagged, never
an Excel skill requirement on its own. Quotes remain verbatim and at most 25 words.
"""
from __future__ import annotations

import json
import re
import sys
import time
import unicodedata
from pathlib import Path
from datetime import datetime, timezone
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "velho-game-data"))
from scraper.fetch import PoliteFetcher
from scraper.jobly import BASE, CATEGORIES, parse_ad, parse_listing

MAX_ADS = 10

TASK = re.compile(
    r"\b(manual(?:ly)?\s+(?:data|entry|report|invoice|reconcil|process)|data entry|"
    r"copy(?:ing)?\s+.*between systems|enter(?:ing)?\s+.*(?:data|invoices)|"
    r"maintain(?:ing)?\s+.*(?:spreadsheets|excel)|"
    r"manuaalis\w*\s+(?:tiet\w*|kirj\w*|raport\w*|lask\w*|syöt\w*|siir\w*|täsm\w*)|käsin\s+(?:kirja\w*|syött\w*|siirt\w*)|"
    r"tietojen\s+(?:syött\w*|kirjaa\w*|siirt\w*)|"
    r"laskujen\s+(?:kirjaa\w*|syött\w*)|excel\w*\s+(?:ylläpi\w*|päivitt\w*))",
    re.IGNORECASE,
)


def repetitive_quote(description: str) -> str:
    for sentence in re.split(r"[\n.!?]+", description):
        match = TASK.search(sentence)
        if match:
            words = list(re.finditer(r"\S+", sentence))
            index = next((i for i, word in enumerate(words) if word.end() > match.start()), 0)
            start = max(0, index - 4)
            end = min(len(words), start + 25)
            return sentence[words[start].start():words[end - 1].end()].strip()
    return ""


class FreshFetcher(PoliteFetcher):
    def __init__(self, source: str):
        # Dashboard batches run consecutively; only failed-request retries back off.
        super().__init__(source, min_interval=0)
        self.page_fetched_at = {}

    def _get_raw(self, url: str) -> str:
        cache = self._cache_path(url)
        ttl = 86400 if url.endswith("/robots.txt") else 120 if "/tyopaikat/" in url else 900
        if cache.exists() and 0 <= time.time() - cache.stat().st_mtime < ttl:
            self.page_fetched_at[url] = cache.stat().st_mtime
            return cache.read_text(encoding="utf-8")
        text = self._request(url)
        cache.write_text(text, encoding="utf-8")
        self.page_fetched_at[url] = cache.stat().st_mtime
        return text



def collect_ads(offset: int):
    slug, category = CATEGORIES[offset % len(CATEGORIES)]
    fetcher = FreshFetcher("jobly-dashboard")
    try:
        hints = parse_listing(fetcher.get(f"{BASE}/tyopaikat/{slug}"), category)
        # Fixed source URL boundary even if a listing contains an unexpected external link.
        hints = [hint for hint in hints if urlparse(hint["url"]).hostname == "www.jobly.fi"]
        if not hints:
            raise RuntimeError("No current ads found on the listing. Existing data was kept.")
        ads = []
        seen = set()
        for hint in hints:
            if hint["url"] in seen:
                continue
            seen.add(hint["url"])
            job = parse_ad(fetcher.get(hint["url"]), hint["url"], hint)
            if job and job["company_name"] and job["description_raw"]:
                ascii_name = unicodedata.normalize("NFKD", job["company_name"]).encode("ascii", "ignore").decode()
                ads.append({
                    "companyId": re.sub(r"[^a-z0-9]+", "-", ascii_name.lower()).strip("-"),
                    "companyName": job["company_name"], "title": job["job_title"],
                    "quote": repetitive_quote(job["description_raw"]), "url": job["url"],
                    "location": job["location"], "category": category,
                    "fetchedAt": datetime.fromtimestamp(fetcher.page_fetched_at[hint["url"]], timezone.utc).isoformat(timespec="seconds"),
                })
            if len(seen) >= MAX_ADS:
                break
        if not ads:
            raise RuntimeError("No readable job descriptions found. Existing data was kept.")
        return {"ads": ads, "category": category}
    finally:
        fetcher.client.close()


if __name__ == "__main__":
    offset = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    print(json.dumps(collect_ads(offset), ensure_ascii=False))
