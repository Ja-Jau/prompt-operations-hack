"""Build src/data/companies.json from pipeline/data/companies.csv.

Steps:
  1. Validate every row (required fields, sane numbers, unique ids).
  2. Fill missing `why` / `hint` text with Claude (skipped with --no-ai or when no credentials).
  3. Write the JSON the game reads and report rows that still need fact-checking.

Usage:
  python pipeline/build.py            # validate + enrich missing text + export
  python pipeline/build.py --no-ai    # validate + export only
  python pipeline/build.py --force-ai # regenerate why/hint for every row
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "pipeline" / "data" / "companies.csv"
JSON_PATH = ROOT / "src" / "data" / "companies.json"
LOGO_DIR = ROOT / "public" / "logos"
LOGO_EXTENSIONS = (".svg", ".png", ".webp", ".jpg")  # first match wins, so press-kit SVGs beat favicons
DEFAULT_BRAND_COLOR = "#334155"
IMAGE_DIR = ROOT / "public" / "images"
CREDITS_PATH = IMAGE_DIR / "credits.json"
JOB_ADS_PATH = ROOT / "pipeline" / "data" / "job_ads.json"

MODEL = "claude-opus-5-5"

# Revenue per employee outside this range is almost certainly a typo (e.g. revenue in € instead of €M).
MIN_RPE = 10_000
MAX_RPE = 20_000_000

TEXT_SCHEMA = {
    "type": "object",
    "properties": {
        "why": {"type": "string"},
        "hint": {"type": "string"},
    },
    "required": ["why", "hint"],
    "additionalProperties": False,
}

PROMPT = """You write copy for "Tehokas", a higher/lower game where players guess which
Finnish company earns more revenue per employee.

Company: {name}
Industry: {industry}
Revenue: €{revenue_eur_m}M, employees: {employees} (fiscal year {fiscal_year})
Revenue per employee: €{rpe:,.0f}

Write two short English fields:
- why: one sentence (max 20 words) explaining, from the business model, why revenue per
  employee is high or low. Neutral and factual, never mocking the company. No numbers.
- hint: one short clue (max 12 words) describing what the company does, without naming it."""


class RowError(ValueError):
    pass


def find_logo(company_id: str) -> str | None:
    """Public URL of the company's logo in public/logos/, if one has been added."""
    for ext in LOGO_EXTENSIONS:
        if (LOGO_DIR / f"{company_id}{ext}").exists():
            return f"/logos/{company_id}{ext}"
    return None


def load_image_credits() -> dict:
    credits = {"industries": {}, "companies": {}}
    if CREDITS_PATH.exists():
        credits.update(json.loads(CREDITS_PATH.read_text(encoding="utf-8")))
    return credits


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def attach_images(rows: list[dict]) -> None:
    """Link each company's background photo: its own if fetched, else its industry's (see fetch_images.py)."""
    credits = load_image_credits()
    for row in rows:
        own = IMAGE_DIR / f"{row['id']}.jpg"
        industry_slug = slugify(row["industry"])
        industry = IMAGE_DIR / "industry" / f"{industry_slug}.jpg"
        if own.exists() and row["id"] in credits["companies"]:
            row["image"], row["imageCredit"] = f"/images/{row['id']}.jpg", credits["companies"][row["id"]]
        elif industry.exists() and industry_slug in credits["industries"]:
            row["image"] = f"/images/industry/{industry_slug}.jpg"
            row["imageCredit"] = credits["industries"][industry_slug]
        else:
            row["image"], row["imageCredit"] = None, None


def parse_row(row: dict[str, str], line: int) -> dict:
    def required(key: str) -> str:
        value = (row.get(key) or "").strip()
        if not value:
            raise RowError(f"line {line}: missing '{key}'")
        return value

    try:
        revenue = float(required("revenue_eur_m"))
        employees = int(required("employees"))
        fiscal_year = int(required("fiscal_year"))
    except ValueError as exc:
        raise RowError(f"line {line}: bad number ({exc})") from exc

    if revenue <= 0 or employees <= 0:
        raise RowError(f"line {line}: revenue and employees must be positive")

    rpe = revenue * 1_000_000 / employees
    if not MIN_RPE <= rpe <= MAX_RPE:
        raise RowError(f"line {line}: revenue per employee €{rpe:,.0f} looks wrong")

    brand_color = (row.get("brand_color") or "").strip() or DEFAULT_BRAND_COLOR
    if not re.fullmatch(r"#[0-9a-fA-F]{6}", brand_color):
        raise RowError(f"line {line}: brand_color must look like #1450f5")

    company_id = required("id")
    return {
        "id": company_id,
        "name": required("name"),
        "industry": required("industry"),
        "revenueEurM": revenue,
        "employees": employees,
        "fiscalYear": fiscal_year,
        "domain": (row.get("domain") or "").strip() or None,
        "brandColor": brand_color,
        "logo": find_logo(company_id),
        "sourceUrl": (row.get("source_url") or "").strip() or None,
        "verified": (row.get("verified") or "").strip().lower() == "true",
        "why": (row.get("why") or "").strip(),
        "hint": (row.get("hint") or "").strip(),
    }


def load_rows() -> list[dict]:
    with CSV_PATH.open(encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        rows, errors, seen = [], [], set()
        for line, raw in enumerate(reader, start=2):
            try:
                row = parse_row(raw, line)
            except RowError as exc:
                errors.append(str(exc))
                continue
            if row["id"] in seen:
                errors.append(f"line {line}: duplicate id '{row['id']}'")
                continue
            seen.add(row["id"])
            rows.append(row)

    if errors:
        print("Validation failed:", *errors, sep="\n  ", file=sys.stderr)
        sys.exit(1)
    return rows


def enrich(rows: list[dict], force: bool) -> None:
    todo = [r for r in rows if force or not r["why"] or not r["hint"]]
    if not todo:
        return

    try:
        import anthropic
    except ImportError:
        print("anthropic not installed; skipping AI text (pip install -r pipeline/requirements.txt)")
        return

    client = anthropic.Anthropic()
    for row in todo:
        rpe = row["revenueEurM"] * 1_000_000 / row["employees"]
        prompt = PROMPT.format(
            name=row["name"],
            industry=row["industry"],
            revenue_eur_m=row["revenueEurM"],
            employees=row["employees"],
            fiscal_year=row["fiscalYear"],
            rpe=rpe,
        )
        try:
            response = client.beta.messages.create(
                model=MODEL,
                max_tokens=1024,
                betas=["server-side-fallback-2026-07-01"],
                fallbacks="default",
                output_config={
                    "effort": "low",
                    "format": {"type": "json_schema", "schema": TEXT_SCHEMA},
                },
                messages=[{"role": "user", "content": prompt}],
            )
        except anthropic.AuthenticationError:
            print("No valid Anthropic credentials; skipping AI text.")
            return
        except anthropic.APIError as exc:
            print(f"  {row['id']}: API error, keeping existing text ({exc})")
            continue

        if response.stop_reason != "end_turn":
            print(f"  {row['id']}: stopped with '{response.stop_reason}', keeping existing text")
            continue

        text = next(b.text for b in response.content if b.type == "text")
        fields = json.loads(text)
        row["why"], row["hint"] = fields["why"], fields["hint"]
        print(f"  {row['id']}: generated why/hint")


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")  # Windows consoles default to cp1252 and mangle ä/ö
    sys.stderr.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--no-ai", action="store_true", help="skip Claude enrichment")
    parser.add_argument("--force-ai", action="store_true", help="regenerate why/hint for every row")
    args = parser.parse_args()

    rows = load_rows()
    attach_images(rows)
    job_ads = json.loads(JOB_ADS_PATH.read_text(encoding="utf-8")) if JOB_ADS_PATH.exists() else {}
    for row in rows:
        row["jobAds"] = job_ads.get(row["id"])
    if not args.no_ai:
        enrich(rows, force=args.force_ai)

    missing_text = [r["id"] for r in rows if not r["why"] or not r["hint"]]
    if missing_text:
        print("Rows without why/hint (game needs both):", ", ".join(missing_text), file=sys.stderr)
        sys.exit(1)

    JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
    JSON_PATH.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    unverified = [r["name"] for r in rows if not r["verified"]]
    no_logo = [r["id"] for r in rows if not r["logo"]]
    print(f"Wrote {len(rows)} companies to {JSON_PATH.relative_to(ROOT)}")
    no_image = [r["id"] for r in rows if not r["image"]]
    with_ads = sum(1 for r in rows if r["jobAds"])
    print(f"{with_ads} of {len(rows)} companies have job-ad data for Velho rounds"
          + ("" if with_ads else " (run pipeline/fetch_job_ads.py)"))
    if no_logo:
        print(f"{len(no_logo)} without a logo (run pipeline/fetch_logos.py): {', '.join(no_logo)}")
    if no_image:
        print(f"{len(no_image)} without a photo (run pipeline/fetch_images.py): {', '.join(no_image)}")
    if unverified:
        print(f"{len(unverified)} not yet verified against an annual report: {', '.join(unverified)}")


if __name__ == "__main__":
    main()
