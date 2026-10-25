"""Bounded dashboard refresh: one rotating Jobly category, five current ad pages.

Print JSON only. Reuses the source parser, robots checks and throttling; no AI key needed.
The app passes a category offset. Only explicit task descriptions are flagged, never
an Excel skill requirement on its own. Quotes remain verbatim and at most 25 words.
"""
from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "velho-game-data"))
from scraper.fetch import PoliteFetcher, USER_AGENT
from scraper.jobly import BASE, CATEGORIES, parse_ad, parse_listing

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
    def _get_raw(self, url: str) -> str:
        # Refreshes need current pages rather than the scraper's permanent HTML cache.
        return self._request(url)

    def _allowed(self, url: str) -> bool:
        allowed = super()._allowed(url)
        parsed = urlparse(url)
        rules = self._robots[f"{parsed.scheme}://{parsed.netloc}"]
        self.min_interval = max(self.min_interval, rules.crawl_delay(USER_AGENT) or rules.crawl_delay("*") or 0)
        return allowed


def main():
    offset = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    slug, category = CATEGORIES[offset % len(CATEGORIES)]
    fetcher = FreshFetcher("jobly-dashboard", min_interval=10)
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
                    "location": job["location"], "category": category, "fetchedAt": job["scraped_at"],
                })
            if len(seen) >= 5:
                break
        if not ads:
            raise RuntimeError("No readable job descriptions found. Existing data was kept.")
        print(json.dumps({"ads": ads, "category": category}, ensure_ascii=False))
    finally:
        fetcher.client.close()


if __name__ == "__main__":
    main()
