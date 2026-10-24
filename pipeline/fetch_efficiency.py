"""Fetch official ESEF reports, review scraped ads, and export four game metrics.

python3 pipeline/fetch_efficiency.py             # refresh stale/missing reports
python3 pipeline/fetch_efficiency.py --offline   # rebuild from saved financial facts
python3 pipeline/fetch_efficiency.py --company harvia --force
No API key or AI extraction required. See pipeline/EFFICIENCY.md.
"""
from __future__ import annotations

import argparse
from collections import defaultdict
import csv
from datetime import datetime, timezone
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlparse, unquote
from urllib.request import Request, urlopen
from xml.etree.ElementTree import ParseError
from zipfile import BadZipFile

from efficiency_data import METRICS, employer_key, financial_metrics, job_metric
from esef import employee_table_facts, financial_record, parse_report

ROOT = Path(__file__).resolve().parent.parent
FACTS_PATH = ROOT / "pipeline/data/financial_facts.json"
OUTPUT_PATH = ROOT / "src/data/efficiency.json"
COVERAGE_PATH = ROOT / "pipeline/data/efficiency_coverage.json"
CACHE = ROOT / "pipeline/.cache/efficiency"
USER_AGENT = "TehokasResearch/1.0 (public annual-report data; low-volume research)"
MAX_BYTES = 80_000_000


def read_json(path: Path, default):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else default


def write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    temporary.replace(path)


def fetch(url: str, force: bool = False, *, max_age_days: int = 7, before_request=None) -> tuple[bytes, str]:
    if urlparse(url).scheme != "https":
        raise ValueError("Only HTTPS report sources are supported")
    CACHE.mkdir(parents=True, exist_ok=True)
    key = hashlib.sha256(url.encode()).hexdigest()
    cached, metadata = CACHE / key, CACHE / (key + ".json")
    if cached.exists() and metadata.exists() and not force:
        info = read_json(metadata, {})
        if (datetime.now(timezone.utc) - datetime.fromisoformat(info["fetchedAt"])).total_seconds() < max_age_days * 86_400:
            return cached.read_bytes(), info["fetchedAt"]
    for attempt in range(3):
        try:
            if before_request:
                before_request()
            with urlopen(Request(url, headers={"User-Agent": USER_AGENT}), timeout=35) as response:
                content = response.read(MAX_BYTES + 1)
            if len(content) > MAX_BYTES:
                raise ValueError("Report exceeds download size limit")
            fetched_at = datetime.now(timezone.utc).isoformat()
            cached.write_bytes(content)
            write_json(metadata, {"url": url, "fetchedAt": fetched_at})
            return content, fetched_at
        except HTTPError as exc:
            if exc.code not in (429, 500, 502, 503, 504) or attempt == 2:
                raise
        except URLError:
            if attempt == 2:
                raise
        time.sleep(2 ** attempt)
    raise ValueError("Download failed")


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links, self.current = [], None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "a" and attrs.get("href"):
            self.current = [attrs["href"], attrs.get("title", "") + " " + attrs.get("aria-label", "")]

    def handle_data(self, data):
        if self.current:
            self.current[1] += " " + data

    def handle_endtag(self, tag):
        if tag == "a" and self.current:
            self.links.append(self.current)
            self.current = None


def discover(config: dict, year: int, force: bool = False) -> list[str]:
    if config.get("reportUrl"):
        return [config["reportUrl"].format(year=year)]
    landing = config["landingUrl"].format(year=year)
    content, _ = fetch(landing, force)
    parser = Links()
    parser.feed(content.decode("utf-8", errors="replace"))
    ranked, follow = [], []
    for href, title in parser.links:
        url = urljoin(landing, href)
        if urlparse(url).scheme != "https":
            continue
        text = unquote(url + " " + title).lower()
        tagged = any(w in text for w in ("esef", "xhtml", "xbrl")) or bool(re.search(r"[a-z0-9]{20}-" + str(year) + r"-12-31", text))
        file = bool(re.search(r"\.(?:zip|xhtml|html|xbrl)(?:[?#]|$)", url, re.I))
        if (tagged or file and ".zip" in url.lower()) and str(year) in text:
            ranked.append((int(tagged) * 10 + int("en" in urlparse(url).path.split("/")), url))
        elif str(year) in text and any(w in text for w in ("annual", "financial", "report", "vuosi", "tilinp")) and not re.search(r"\.(pdf|xlsx|pptx)(?:[?#]|$)", url, re.I):
            if urlparse(url).hostname == urlparse(landing).hostname:
                follow.append(url)
        elif tagged and str(year - 1) not in text:
            ranked.append((1, url))
    # Follow at most two report landing pages, never crawl an entire website.
    if not ranked:
        for url in list(dict.fromkeys(follow))[:2]:
            try:
                content, _ = fetch(url, force)
                child = Links()
                child.feed(content.decode("utf-8", errors="replace"))
                for href, title in child.links:
                    target = urljoin(url, href)
                    text = unquote(target + " " + title).lower()
                    if str(year) in text and any(w in text for w in ("esef", "xhtml", "xbrl", ".zip")):
                        ranked.append((5, target))
            except (HTTPError, URLError, ValueError):
                continue
    return list(dict.fromkeys(url for _, url in sorted(ranked, key=lambda item: -item[0])))[:4]


def load_company_jobs(companies: list[dict], source_config: dict) -> dict[str, list[dict]]:
    jobs = read_json(ROOT / "velho-game-data/data/jobs_raw.json", [])
    by_name = {}
    for c in companies:
        for name in [c["name"], *source_config.get(c["id"], {}).get("jobNames", [])]:
            by_name[employer_key(name)] = c["id"]
    grouped = defaultdict(list)
    for job in jobs:
        company_id = by_name.get(employer_key(job["company_name"]))
        if company_id:
            grouped[company_id].append(job)
    for cid, sample in read_json(ROOT / "pipeline/data/job_samples.json", {}).items():
        if cid in {c["id"] for c in companies} and (sample["ads"] or not sample.get("error")):
            grouped[cid] = sample["ads"]
    return grouped


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--offline", action="store_true")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--company", action="append", help="refresh selected IDs; export still includes every company")
    parser.add_argument("--year", type=int, default=datetime.now(timezone.utc).year - 1)
    parser.add_argument("--strict", action="store_true", help="exit nonzero when any category has fewer than two observations")
    parser.add_argument("--refresh-jobs", action="store_true", help="discover and fetch a fresh bounded Jobly sample for each company")
    parser.add_argument("--job-delay", type=float, default=0.25, help="seconds between job-source requests (default: 0.25)")
    args = parser.parse_args()
    if args.job_delay < 0:
        parser.error("--job-delay must be non-negative")
    companies = list(csv.DictReader((ROOT / "pipeline/data/companies.csv").open(encoding="utf-8")))
    ids = {c["id"] for c in companies}
    if args.company and set(args.company) - ids:
        parser.error("Unknown company ID: " + ", ".join(set(args.company) - ids))
    sources = read_json(ROOT / "pipeline/data/report_sources.json", {})
    if args.refresh_jobs:
        if args.offline:
            parser.error("--refresh-jobs cannot be combined with --offline")
        from fetch_job_samples import refresh_samples
        refresh_samples(companies, sources, selected=set(args.company or ids), delay=args.job_delay)
    financials = read_json(FACTS_PATH, {})
    failures = {cid: row["fetchError"] for cid, row in read_json(COVERAGE_PATH, {}).items() if row.get("fetchError")}
    if not args.offline:
        for company in companies:
            cid = company["id"]
            if args.company and cid not in args.company:
                continue
            config = sources.get(cid)
            if not config:
                failures[cid] = "No official report source configured"
                continue
            print(f"{cid}: looking for FY {args.year} report", flush=True)
            try:
                urls = discover(config, args.year, args.force)
                if not urls:
                    raise ValueError(config.get("note", "No ESEF report link found; configure reportUrl or use a reviewed extraction"))
                errors = []
                for url in urls:
                    try:
                        content, fetched_at = fetch(url, args.force)
                        facts = parse_report(content)
                        record = financial_record(facts, config, args.year, url, fetched_at)
                        if config.get("employeeTable") and record["facts"].get("revenue"):
                            record["facts"].update(employee_table_facts(content, config["employeeTable"], args.year,
                                record["facts"]["revenue"]["entity"]))
                            record["employeeBasis"] = config["employeeTable"]["basis"]
                        if not any(record["facts"].values()):
                            raise ValueError("No supported unsegmented facts for the requested year")
                        financials[cid] = record
                        failures.pop(cid, None)
                        write_json(FACTS_PATH, financials)  # checkpoint every company
                        # Numeric concept inventory makes reviewing employee mappings straightforward.
                        write_json(CACHE / f"{cid}-concepts.json", sorted({f["concept"] for f in facts}))
                        print(f"  imported {sum(v is not None for v in record['facts'].values())} inputs", flush=True)
                        break
                    except (HTTPError, URLError, ParseError, BadZipFile, ValueError) as exc:
                        errors.append(str(exc))
                else:
                    raise ValueError("; ".join(errors))
            except (HTTPError, URLError, ParseError, ValueError) as exc:
                failures[cid] = str(exc)
                print(f"  unavailable: {exc}", flush=True)
            time.sleep(0.3)

    grouped = load_company_jobs(companies, sources)
    output, coverage = {}, {}
    for company in companies:
        cid = company["id"]
        record = financials.get(cid)
        # Do not silently serve another year's financials after a failed refresh.
        if record and record["year"] != args.year:
            record = None
        metrics, missing = financial_metrics(record)
        ads, reason = job_metric(grouped[cid])
        if ads:
            metrics["manualAds"] = ads
        else:
            missing["manualAds"] = reason
        output[cid] = {"metrics": metrics, "missing": missing}
        coverage[cid] = {"available": list(metrics), "missing": missing, "fetchError": failures.get(cid),
                         "financialFetchedAt": record["fetchedAt"] if record else None}
    write_json(OUTPUT_PATH, output)
    write_json(COVERAGE_PATH, coverage)
    print(f"\nExported {len(output)} companies to {OUTPUT_PATH.relative_to(ROOT)}")
    counts = {m: sum(m in c["metrics"] for c in output.values()) for m in METRICS}
    print("Coverage: " + ", ".join(f"{m}={n}" for m, n in counts.items()))
    if args.strict and any(n < 2 for n in counts.values()):
        raise SystemExit("Some categories need more sourced observations; see pipeline/data/efficiency_coverage.json")


if __name__ == "__main__":
    main()
