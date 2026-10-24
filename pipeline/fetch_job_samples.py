"""Bounded public Jobly samples. Exact employer aliases, no AI labels.

Invoked by fetch_efficiency.py --refresh-jobs. This is a SAMPLE of listings, not
an exhaustive census of a company's roles. Failed/expired ads are not counted.
"""
from __future__ import annotations

from datetime import datetime, timezone
from html.parser import HTMLParser
import hashlib
import json
import re
import time
from urllib.parse import urlencode, urljoin, urlparse
from urllib.error import HTTPError, URLError

from fetch_efficiency import ROOT, USER_AGENT, fetch, read_json, write_json
from efficiency_data import employer_key

BASE = "https://www.jobly.fi"
MAX_ADS = 12
MAX_PAGES = 1


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.scripts, self.capture, self.current = [], False, ""

    def handle_starttag(self, tag, attrs):
        if tag == "script" and dict(attrs).get("type", "").lower() == "application/ld+json":
            self.capture, self.current = True, ""

    def handle_data(self, data):
        if self.capture:
            self.current += data

    def handle_endtag(self, tag):
        if tag == "script" and self.capture:
            self.scripts.append(self.current)
            self.capture = False


class Text(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag in ("p", "div", "li", "br"):
            self.parts.append("\n")

    def handle_data(self, data):
        self.parts.append(data)


class Listing(HTMLParser):
    """Read employer identity from each search card before requesting its ad."""
    def __init__(self):
        super().__init__()
        self.depth = 0
        self.card_depth = None
        self.url = ""
        self.employer = ""
        self.company_tag = None
        self.items = []

    def handle_starttag(self, tag, attrs):
        # Jobly currently emits duplicate class attributes; keep both values.
        classes = " ".join(value or "" for key, value in attrs if key == "class").split()
        attrs = dict(attrs)
        if tag == "div":
            self.depth += 1
            if "job__content" in classes:
                self.card_depth, self.url, self.employer = self.depth, "", ""
        if self.card_depth is not None:
            if tag == "a" and "recruiter-job-link" in classes:
                self.url = attrs.get("href", "")
            if "recruiter-company-profile-job-organization" in classes:
                self.company_tag = tag

    def handle_data(self, data):
        if self.company_tag:
            self.employer += data

    def handle_endtag(self, tag):
        if tag == self.company_tag:
            self.company_tag = None
        if tag == "div":
            if self.depth == self.card_depth:
                if self.url:
                    self.items.append((urljoin(BASE, self.url), self.employer.strip()))
                self.card_depth = None
            self.depth -= 1


def job_postings(value):
    if isinstance(value, list):
        for item in value:
            yield from job_postings(item)
    elif isinstance(value, dict):
        types = value.get("@type", [])
        if types == "JobPosting" or isinstance(types, list) and "JobPosting" in types:
            yield value
        if "@graph" in value:
            yield from job_postings(value["@graph"])


def parse_posting(content: bytes, url: str, aliases: set[str], fetched_at: str) -> dict | None:
    page = Page()
    page.feed(content.decode("utf-8", errors="replace"))
    for script in page.scripts:
        try:
            postings = list(job_postings(json.loads(script)))
        except json.JSONDecodeError:
            continue
        for posting in postings:
            employer = posting.get("hiringOrganization") or {}
            if not isinstance(employer, dict) or not isinstance(employer.get("name"), str):
                continue
            name = employer.get("name", "").strip()
            if employer_key(name) not in aliases:
                continue
            deadline = posting.get("validThrough")
            if deadline:
                try:
                    if datetime.fromisoformat(deadline[:10]).date() < datetime.now(timezone.utc).date():
                        continue
                except ValueError:
                    continue
            text = Text()
            description_html = posting.get("description")
            if not isinstance(description_html, str):
                continue
            text.feed(description_html)
            description = "\n".join(re.sub(r"[ \t]+", " ", line).strip() for line in "".join(text.parts).splitlines())
            description = re.sub(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", "[email omitted]", description)
            if not description.strip():
                continue
            return {"id": hashlib.sha256(url.encode()).hexdigest()[:16], "source": "jobly.fi",
                    "url": url, "company_name": name, "job_title": posting.get("title", "Role"),
                    "description_raw": description, "scraped_at": fetched_at,
                    "posted_date": posting.get("datePosted"), "valid_through": deadline}
    return None


def refresh_samples(companies: list[dict], config: dict, selected: set[str], delay: float = 0.25) -> None:
    path = ROOT / "pipeline/data/job_samples.json"
    results = read_json(path, {})
    names = {c["id"]: {employer_key(c["name"]), *(employer_key(n) for n in config.get(c["id"], {}).get("jobNames", []))} for c in companies}
    last_request = 0.0

    def get(url):
        if urlparse(url).hostname != urlparse(BASE).hostname:
            raise ValueError("Job sample URL is outside the configured source")
        def wait_for_source():
            nonlocal last_request
            time.sleep(max(0, delay - (time.monotonic() - last_request)))
            last_request = time.monotonic()
        # Resume interrupted refreshes without downloading identical pages again.
        # Sampling time comes from the cache metadata, never from this run's clock.
        return fetch(url, max_age_days=1, before_request=wait_for_source)

    for company in companies:
        cid = company["id"]
        if cid not in selected:
            continue
        print(f"{cid}: sampling public job ads", flush=True)
        samples, seen, error = [], set(), None
        try:
            for page_no in range(MAX_PAGES):
                listing = BASE + "/tyopaikat?" + urlencode({"search": company["name"], "page": page_no})
                content, _ = get(listing)
                links = Listing()
                links.feed(content.decode("utf-8", errors="replace"))
                urls = list(dict.fromkeys(url.split("#")[0] for url, employer in links.items
                                         if employer_key(employer) in names[cid]))
                if not urls:
                    break
                for url in urls:
                    if url in seen:
                        continue
                    seen.add(url)
                    print(f"  reading ad {len(seen)}", flush=True)
                    try:
                        content, sampled_at = get(url)
                        job = parse_posting(content, url, names[cid], sampled_at)
                        if job:
                            samples.append(job)
                    except (HTTPError, URLError, ValueError) as exc:
                        error = str(exc)
                        if isinstance(exc, HTTPError) and exc.code in (401, 403, 429):
                            raise
                    if len(samples) >= MAX_ADS or len(seen) >= MAX_ADS * 2:
                        break
                if len(samples) >= MAX_ADS or len(seen) >= MAX_ADS * 2:
                    break
        except (HTTPError, URLError, ValueError) as exc:
            error = str(exc)
        if error and not samples:
            # Retain a previous sample on transient errors; its original date is kept.
            samples = results.get(cid, {}).get("ads", [])
        results[cid] = {"ads": samples, "error": error, "sampledAt": datetime.now(timezone.utc).isoformat()}
        write_json(path, results)
        print(f"  {len(samples)} matched ads" + (f"; {error}" if error else ""), flush=True)
