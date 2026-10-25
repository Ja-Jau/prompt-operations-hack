"""Validated efficiency observations, independent of fetching and presentation."""
from __future__ import annotations

from datetime import date, datetime, timezone
import math
import re

METRICS = ("revenue", "revenueGrowth", "growthGap", "manualAds", "adminRatio", "inventoryDays")
MIN_ADS = 3
MAX_AD_AGE_DAYS = 90

# Precision before recall: Excel/ERP/reporting alone does not establish repetitive work.
# These versioned rules detect explicit task descriptions in English and Finnish.
CLASSIFIER_VERSION = "explicit-tasks-v1"


def employer_key(name: str) -> str:
    """Exact name matching apart from trailing legal suffixes; never prefix/fuzzy matches."""
    return re.sub(r"(?:[\s,.]+(?:oyj|oy|abp|ab|plc|ltd|inc|corporation))+$", "", name.strip(), flags=re.I).casefold().strip()


TASK_PATTERNS = [
    r"\b(?:manual(?:ly)?|repetitive)\s+(?:data\s+)?(?:entry|processing|reporting|reconciliation|tasks?|work|updates?)\b",
    r"\b(?:enter(?:ing)?|input(?:ting)?|key(?:ing)?|re[- ]?enter(?:ing)?)\s+(?:\w+\s+){0,3}(?:data|orders?|invoices?)\s+(?:\w+\s+){0,3}(?:into|in|to)\b",
    r"\b(?:maintain(?:ing)?|updat(?:e|ing)|compil(?:e|ing)|prepar(?:e|ing))\s+(?:\w+\s+){0,5}(?:Excel|spreadsheets?)\b",
    r"\b(?:copy(?:ing)?|transfer(?:ring)?)\s+(?:\w+\s+){0,3}(?:data|information)\s+(?:\w+\s+){0,3}(?:between|from)\b",
    r"\b(?:process(?:ing)?|reconcil(?:e|ing)|match(?:ing)?)\s+(?:\w+\s+){0,3}(?:invoices?|payments?|purchase orders?)\b",
    r"\b(?:creat(?:e|ing)|enter(?:ing)?|updat(?:e|ing))\s+(?:\w+\s+){0,3}(?:work orders?|sales orders?|purchase orders?)\s+(?:\w+\s+){0,3}(?:ERP|system)\b",
    r"\b(?:pre[- ]?payroll|post[- ]?payroll|payroll|bank|account)\s+reconciliations?\b",
    r"\b(?:review|correct|check)(?:ing)?\s+(?:\w+\s+){0,4}(?:working time|timesheet|time sheet)\s+(?:transactions?|entries|records)\b",
    r"\b(?:creat(?:e|ing)|maintain(?:ing)?|updat(?:e|ing))\s+(?:\w+\s+){0,3}(?:shift calendars?|shift schedules?)\b",
    r"\b(?:käsin|manuaalis\w*)\s+(?:\w+\s+){0,3}(?:kirj\w*|syöt\w*|käsitt\w*|päivit\w*|raport\w*)",
    r"\b(?:tietojen|tilausten|laskujen|asiakastietojen)\s+(?:\w+\s+){0,2}(?:syött\w*|kirjaa\w*|tallent\w*)",
    r"\b(?:excel\w*|tauluk\w*)\s+(?:\w+\s+){0,2}(?:ylläpi\w*|päivit\w*|raport\w*)",
    r"\b(?:osto|myynti)?laskujen\s+(?:\w+\s+){0,2}(?:käsitt\w*|tarkast\w*|täsmä\w*|tiliö\w*)",
]
TASK_RULES = [re.compile(p, re.IGNORECASE) for p in TASK_PATTERNS]
# Explicit negation/automation means the text is not evidence of a manual task.
AUTOMATION = re.compile(r"\b(?:automat\w*|automatis\w*|eliminat\w*|remov\w*|no longer|without|ei\s+enää)\b", re.I)


def classify_task(text: str) -> str | None:
    for sentence in re.split(r"[\n.!?;]+", text):
        sentence = re.sub(r"\s+", " ", sentence).strip()
        if AUTOMATION.search(sentence):
            continue
        if any(rule.search(sentence) for rule in TASK_RULES):
            # Keep the complete sentence as evidence; no invented/AI-rewritten quotes.
            return sentence
    return None


def observation(value: float, *, year: int | None, period: str, scope: str, definition: str,
                sources: list[dict], inputs: dict, fetched_at: str, note: str) -> dict:
    if not math.isfinite(value) or not sources:
        raise ValueError("An observation needs a finite value and source evidence")
    return {"value": round(value, 6), "year": year, "period": period, "scope": scope,
            "definition": definition, "sources": sources, "inputs": inputs, "fetchedAt": fetched_at, "note": note}


def financial_metrics(record: dict | None) -> tuple[dict, dict]:
    metrics, missing = {}, {}
    if not record:
        return {}, {k: "No supported public financial report imported" for k in METRICS if k != "manualAds"}
    facts = record["facts"]
    year = record["year"]
    revenue = facts.get("revenue")
    def get(key: str) -> float | None:
        fact = facts.get(key)
        if not fact or not isinstance(fact.get("value"), (float, int)) or not math.isfinite(fact["value"]):
            return None
        return fact["value"]

    def make(key: str, value: float, keys: list[str], definition: str, note: str) -> None:
        selected = [facts[k] for k in keys]
        # A report may contain several legal entities: never combine their numbers.
        if len({f["entity"] for f in selected}) != 1:
            missing[key] = "Inputs refer to different reporting entities"
            return
        metrics[key] = observation(value, year=year, period=f"FY {year}", scope=record["scope"],
            definition=definition, fetched_at=record["fetchedAt"], note=note,
            inputs={k: facts[k]["value"] for k in keys},
            sources=[{"url": record["sourceUrl"], "label": f"Financial statements {year}",
                      "evidence": "; ".join(f"{f['concept']} [{f['contextId']}] = {f['value']:g}" +
                          (" (" + f["evidence"] + ")" if f.get("evidence") else "") for f in selected)}])

    r, prior_r, e, prior_e = (get(k) for k in ("revenue", "previousRevenue", "employees", "previousEmployees"))
    if r is not None and r > 0:
        make("revenue", r, ["revenue"], "revenue", f"Reported revenue for {year}, in euros.")
    else:
        missing["revenue"] = "Revenue not reported"
    if r is not None and prior_r is not None and r > 0 and prior_r > 0:
        make("revenueGrowth", (r / prior_r - 1) * 100, ["revenue", "previousRevenue"], "revenue-growth",
             f"Revenue change from {year - 1} to {year}. Acquisitions, divestments and prices affect it.")
    else:
        missing["revenueGrowth"] = "Needs revenue for two full years"
    if all(v is not None and v > 0 for v in (r, prior_r, e, prior_e)) and record.get("employeeBasis"):
        gap = ((r / prior_r - 1) - (e / prior_e - 1)) * 100
        make("growthGap", gap, ["revenue", "previousRevenue", "employees", "previousEmployees"],
             "growth-gap-" + record["employeeBasis"],
             f"Revenue growth minus employee growth, {year - 1}–{year}, in percentage points. "
             "Acquisitions, prices and restructuring can affect both figures.")
    else:
        missing["growthGap"] = "Needs revenue and the same employee-count definition for two full years"

    admin = get("administrativeExpenses")
    if revenue and r and r > 0 and admin is not None and 0 <= abs(admin) / r <= 10:
        make("adminRatio", abs(admin) / r * 100, ["revenue", "administrativeExpenses"], "administrative-expenses-only",
             "Reported administrative expenses / revenue. Selling expenses and combined SG&A are excluded. "
             "Accounting policies and industry affect this ratio.")
    else:
        missing["adminRatio"] = "Administrative expenses not separately disclosed, or inputs invalid"

    inventory, prior_inventory, cogs = (get(k) for k in ("inventory", "previousInventory", "costOfSales"))
    if all(v is not None for v in (inventory, prior_inventory, cogs)) and inventory > 0 and prior_inventory >= 0 and abs(cogs) > 0:
        days = (inventory + prior_inventory) / 2 / abs(cogs) * record["days"]
        if days <= 2000:
            make("inventoryDays", days, ["inventory", "previousInventory", "costOfSales"], "average-inventory-over-cost-of-sales",
                 "Average opening and closing inventory / annual cost of sales × days in the year. "
                 "An accounting estimate, not the measured age of each item. Industry and seasonality matter.")
        else:
            missing["inventoryDays"] = "Inventory days outside validation bounds"
    else:
        missing["inventoryDays"] = "Needs opening and closing inventory and separately reported cost of sales"
    return metrics, missing


def job_metric(company_jobs: list[dict], today: date | None = None) -> tuple[dict | None, str | None]:
    today = today or datetime.now(timezone.utc).date()
    # A scraped ad is reviewed once even if a scraper imported it several times.
    jobs = {j["url"]: j for j in sorted(company_jobs, key=lambda j: j["scraped_at"])
            if j.get("url", "").startswith("https://") and j.get("description_raw", "").strip()}
    recent = []
    for job in jobs.values():
        try:
            scraped = date.fromisoformat(job["scraped_at"][:10])
            posted = date.fromisoformat(job["posted_date"][:10]) if job.get("posted_date") else None
            expires = date.fromisoformat(job["valid_through"][:10]) if job.get("valid_through") else None
        except (ValueError, TypeError, KeyError):
            continue
        if not 0 <= (today - scraped).days <= MAX_AD_AGE_DAYS:
            continue
        if expires and expires < today:
            continue
        if posted and not 0 <= (today - posted).days <= MAX_AD_AGE_DAYS:
            continue
        recent.append(job)
    if len(recent) < MIN_ADS:
        return None, f"Needs at least {MIN_ADS} distinct, non-empty ads sampled within {MAX_AD_AGE_DAYS} days"
    matches = [(job, classify_task(job["description_raw"])) for job in recent]
    positives = [(job, quote) for job, quote in matches if quote]
    # No match proves little about a small sample, so it is not shown as 0%.
    if not positives:
        return None, "No sampled ad describes an explicit repetitive task"
    sampled = max(j["scraped_at"][:10] for j in recent)
    # Include evidence for positives and source links for every ad in the denominator.
    sources = [{"url": j["url"], "label": j["job_title"], "evidence": quote or "No explicit task matched the documented rules"}
               for j, quote in matches]
    value = observation(len(positives) / len(recent) * 100, year=None, period=f"Ads sampled {sampled}",
        scope="job-ad-sample", definition=CLASSIFIER_VERSION, fetched_at=sampled,
        sources=sources, inputs={"checked": len(recent), "manual": len(positives)},
        note="Share of sampled ads matching explicit repetitive-task rules. A conservative text signal, "
             "not the share of staff doing manual work.")
    return value, None
