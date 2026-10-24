"""Shared polite fetcher: robots.txt check, rate limit, backoff, disk cache."""
import hashlib
import os
import time
import urllib.robotparser
from pathlib import Path
from urllib.parse import urlparse

import httpx

USER_AGENT = "VelhoHackathonBot/0.1 (hackathon prototype; local use only; no redistribution)"
RAW_DIR = Path(__file__).resolve().parent.parent / "data" / "raw"
# Jobly robots.txt asks for Crawl-delay 10. Team decision: use 2 s (our own 1-2 s rule). Override via env.
MIN_INTERVAL = float(os.environ.get("VELHO_MIN_INTERVAL", "10"))
BLOCK_MARKERS = ("captcha", "access denied", "are you a robot", "cf-challenge")


class Blocked(Exception):
    """Raised when the site blocks us. We do NOT try to evade it."""


class PoliteFetcher:
    def __init__(self, source: str, min_interval: float = MIN_INTERVAL):
        self.source = source
        self.min_interval = min_interval
        self.cache_dir = RAW_DIR / source
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.client = httpx.Client(headers={"User-Agent": USER_AGENT}, timeout=30, follow_redirects=True)
        self._last = 0.0
        self._robots: dict[str, urllib.robotparser.RobotFileParser] = {}
        self.network_calls = 0

    def _allowed(self, url: str) -> bool:
        p = urlparse(url)
        base = f"{p.scheme}://{p.netloc}"
        if base not in self._robots:
            rp = urllib.robotparser.RobotFileParser()
            rp.parse(self._get_raw(f"{base}/robots.txt").splitlines())
            self._robots[base] = rp
        return self._robots[base].can_fetch(USER_AGENT, url)

    def _cache_path(self, url: str) -> Path:
        return self.cache_dir / (hashlib.sha1(url.encode()).hexdigest()[:16] + ".html")

    def _get_raw(self, url: str) -> str:
        path = self._cache_path(url)
        if path.exists():
            return path.read_text(encoding="utf-8")
        text = self._request(url)
        path.write_text(text, encoding="utf-8")
        return text

    def _request(self, url: str) -> str:
        for attempt in range(4):
            wait = self.min_interval - (time.time() - self._last)
            if wait > 0:
                time.sleep(wait)
            self._last = time.time()
            self.network_calls += 1
            r = self.client.get(url)
            if r.status_code in (403, 401):
                raise Blocked(f"{r.status_code} for {url}")
            if r.status_code == 429 or r.status_code >= 500:
                time.sleep(min(60, 15 * 2**attempt))
                continue
            r.raise_for_status()
            head = r.text[:3000].lower()
            if any(m in head for m in BLOCK_MARKERS):
                raise Blocked(f"block marker in response for {url}")
            return r.text
        raise RuntimeError(f"giving up on {url}")

    def get(self, url: str) -> str:
        """Fetch with cache. Raises PermissionError if robots.txt disallows."""
        if not url.endswith("/robots.txt") and not self._allowed(url):
            raise PermissionError(f"robots.txt disallows {url}")
        return self._get_raw(url)
