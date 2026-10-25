"""Scheduled Jobly -> Supabase sync. Credentials come from environment, never CLI arguments.

Run: python pipeline/sync_dashboard_jobs.py
The GitHub Actions workflow invokes this without a browser or a running Next.js server.
"""
from __future__ import annotations

import json
import os
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from refresh_dashboard_jobs import collect_ads


class Supabase:
    def __init__(self):
        self.url = os.environ.get("SUPABASE_URL", "").rstrip("/")
        self.key = os.environ.get("SUPABASE_SECRET_KEY", "")
        parsed = urlparse(self.url)
        if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.query or parsed.fragment or parsed.path:
            raise RuntimeError("Set SUPABASE_URL to the HTTPS project URL (without a path).")
        if not self.key:
            raise RuntimeError("Set SUPABASE_SECRET_KEY in GitHub Actions secrets.")

    def rpc(self, name: str, body: dict):
        headers = {"apikey": self.key, "Content-Type": "application/json"}
        # The legacy service_role key is a JWT; new sb_secret keys use only apikey.
        if not self.key.startswith("sb_secret_"):
            headers["Authorization"] = f"Bearer {self.key}"
        request = Request(f"{self.url}/rest/v1/rpc/{name}",
                          data=json.dumps(body).encode(), headers=headers, method="POST")
        try:
            with urlopen(request, timeout=45) as response:
                content = response.read()
                return json.loads(content) if content else None
        except HTTPError as error:
            # Do not echo headers, credentials or arbitrary remote error bodies.
            raise RuntimeError(f"Supabase {name} failed (HTTP {error.code}). Check the SQL setup and credentials.") from None
        except (URLError, TimeoutError):
            raise RuntimeError(f"Supabase {name} could not connect. Try again later.") from None


def sync(store=None, scrape=collect_ads):
    store = store or Supabase()
    claim = store.rpc("claim_dashboard_job_refresh", {})
    if claim is None:
        print("A Jobly refresh is already running; skipped.")
        return
    try:
        result = scrape(claim["offset"])
        ads = result["ads"]
        if not ads:
            raise RuntimeError("No readable Jobly ads found. Previous data was kept.")
        store.rpc("finish_dashboard_job_refresh", {"p_token": claim["token"], "p_ads": ads})
    except Exception:
        try:
            store.rpc("fail_dashboard_job_refresh", {"p_token": claim["token"]})
        except Exception:
            print("Could not release refresh lease; it will expire automatically.", file=sys.stderr)
        raise
    print(f"Saved {len(ads)} Jobly ads; {sum(bool(ad['quote']) for ad in ads)} flagged for review.")


if __name__ == "__main__":
    try:
        sync()
    except Exception as error:
        print(f"Jobly sync failed: {error}", file=sys.stderr)
        sys.exit(1)
