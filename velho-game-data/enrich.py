"""LLM enrichment via OpenRouter: adds `description_en` (short English summary) to each job.

Usage:
  python enrich.py --limit 10 --dry-run   # cost estimate only, no API call
  python enrich.py --limit 10             # needs OPENROUTER_API_KEY in env
Output: data/jobs.json (input: data/jobs_raw.json). Already-enriched ads are skipped.
"""
import argparse
import json
import os
import sys
from pathlib import Path

import httpx
from pydantic import BaseModel, Field, ValidationError

DATA = Path(__file__).resolve().parent / "data"
BASE_URL = "https://openrouter.ai/api/v1"
MODEL = "anthropic/claude-haiku-5.5"
PRICE_IN, PRICE_OUT = 0.10 / 1e6, 0.50 / 1e6  # USD per token (checked on /models)
BUDGET_USD = 3.0
BATCH = 5
MAX_DESC_CHARS = 3500

SYSTEM = (
    "You summarise job ads. For each ad write description_en: a faithful 2-3 sentence English "
    "summary of the role (what the person does, key requirements, location/type if stated). "
    "Do not invent facts. Do not include names of people, emails or phone numbers. "
    'Reply with strict JSON only: {"results":[{"id":"...","description_en":"..."}]} '
    "with exactly one entry per input ad, using the given ids."
)


class Item(BaseModel):
    id: str
    description_en: str = Field(min_length=40, max_length=700)


class Result(BaseModel):
    results: list[Item]


def build_prompt(batch: list[dict]) -> str:
    ads = [{"id": j["id"], "title": j["job_title"], "company": j["company_name"],
            "location": j["location"], "text": j["description_raw"][:MAX_DESC_CHARS]} for j in batch]
    return json.dumps(ads, ensure_ascii=False)


def estimate(todo: list[dict]) -> float:
    n_in = sum(len(build_prompt(todo[i:i + BATCH])) + len(SYSTEM) for i in range(0, len(todo), BATCH)) / 3.5
    n_out = len(todo) * 110
    return n_in * PRICE_IN + n_out * PRICE_OUT


class Enricher:
    def __init__(self, key: str):
        self.client = httpx.Client(base_url=BASE_URL, timeout=90,
                                   headers={"Authorization": f"Bearer {key}", "X-Title": "velho-game-data"})
        self.tok_in = self.tok_out = 0

    @property
    def cost(self) -> float:
        return self.tok_in * PRICE_IN + self.tok_out * PRICE_OUT

    def call(self, batch: list[dict], retry_note: str = "") -> Result:
        r = self.client.post("/chat/completions", json={
            "model": MODEL, "temperature": 0.2,
            "response_format": {"type": "json_object"},
            "messages": [{"role": "system", "content": SYSTEM + retry_note},
                         {"role": "user", "content": build_prompt(batch)}]})
        r.raise_for_status()
        body = r.json()
        usage = body.get("usage", {})
        self.tok_in += usage.get("prompt_tokens", 0)
        self.tok_out += usage.get("completion_tokens", 0)
        text = body["choices"][0]["message"]["content"].strip()
        if text.startswith("```"):
            text = text.strip("`").removeprefix("json").strip()
        res = Result.model_validate_json(text)
        got, want = {i.id for i in res.results}, {j["id"] for j in batch}
        if got != want:
            raise ValueError(f"id mismatch: missing {want - got}, extra {got - want}")
        return res

    def enrich_batch(self, batch: list[dict]) -> dict[str, str]:
        try:
            res = self.call(batch)
        except (ValidationError, ValueError, json.JSONDecodeError) as e:
            print("  invalid output, retrying once:", str(e)[:120])
            res = self.call(batch, " Your previous reply was invalid. Return ONLY valid JSON matching the schema.")
        return {i.id: i.description_en.strip() for i in res.results}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=10)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    raw = json.loads((DATA / "jobs_raw.json").read_text())
    out_path = DATA / "jobs.json"
    done = {j["id"]: j for j in json.loads(out_path.read_text())} if out_path.exists() else {}
    todo = [j for j in raw if j["id"] not in done or not done[j["id"]].get("description_en")][: a.limit]

    est = estimate(todo)
    print(f"{len(todo)} ads, model {MODEL}, estimated cost ${est:.4f} (budget stop at ${BUDGET_USD})")
    if est > BUDGET_USD:
        sys.exit("Estimate exceeds budget, aborting.")
    if a.dry_run or not todo:
        return
    key = os.environ.get("OPENROUTER_API_KEY")
    if not key:
        sys.exit("Set OPENROUTER_API_KEY in your environment first.")

    enr = Enricher(key)
    for i in range(0, len(todo), BATCH):
        batch = todo[i:i + BATCH]
        summaries = enr.enrich_batch(batch)
        for j in batch:
            done[j["id"]] = {**j, "description_en": summaries[j["id"]]}
        out_path.write_text(json.dumps(list(done.values()), ensure_ascii=False, indent=1))
        print(f"batch {i // BATCH + 1}: tokens in={enr.tok_in} out={enr.tok_out} cost=${enr.cost:.5f}")
        if enr.cost > BUDGET_USD:
            sys.exit("Budget exceeded, stopping.")
    print(f"done. total tokens in={enr.tok_in} out={enr.tok_out}, actual cost ${enr.cost:.5f}")


if __name__ == "__main__":
    main()
