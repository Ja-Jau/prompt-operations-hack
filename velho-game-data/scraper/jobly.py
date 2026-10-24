"""Jobly.fi source: discover ads from category listing pages, parse JobPosting JSON-LD.

Usage:
  python -m scraper.jobly discover --pages 3      # listing pages -> data/jobly_index.json
  python -m scraper.jobly fetch --limit 10        # ad pages -> data/jobs_raw.json
"""
import argparse
import hashlib
import html as htmlmod
import json
import re
from datetime import datetime, timezone
from pathlib import Path

from bs4 import BeautifulSoup

from .fetch import Blocked, PoliteFetcher

BASE = "https://www.jobly.fi"
DATA = Path(__file__).resolve().parent.parent / "data"

# (slug, site category). Slugs that 404 are skipped.
CATEGORIES = [
    ("hallinto-ja-toimistotyo", "Hallinto- ja toimistotyö"),
    ("talous-ja-rahoitus", "Talous ja rahoitus"),
    ("asiakaspalvelu", "Asiakaspalvelu"),
    ("kuljetus-ja-logistiikka", "Kuljetus ja logistiikka"),
    ("osto-ja-hankinta", "Osto ja hankinta"),
    ("henkilostohallinto", "Henkilöstöhallinto"),
    ("projektihallinto", "Projektihallinto"),
    ("myynti", "Myynti"),
    ("teollisuus", "Teollisuus"),
    ("vahittais-ja-tukkukauppa", "Vähittäis- ja tukkukauppa"),
    ("vakuutus", "Vakuutus"),
    ("it", "IT"),
]

# Staffing/recruiting agencies: the "company" would be the agency, ruining the game.
AGENCY_PATTERN = re.compile(
    r"academic work|clevry|eezy|barona|manpower|adecco|randstad|proffice|opteam|biisoni|"
    r"henkilöstöpalvelu|rekry|recruit|staffing|headhunt|talent partners|executive search|"
    r"intro ?partners|jobiili|vuokratyö|nordic morning|boardman|"
    r"mercuri urval|seeker|tyomarkkina|työvoimapalvelu|bemanning|"
    r"henkilöstöratkaisut|staffpoint|worker |dealboost|suoramarkkinointi|asioimistulkki|"
    r"a-asioimistulkkikeskus|rekrytointi|henkilöstö ?palvelut|temporary|talentum|jelmu|"
    r"aarresaari|baron|posti ?palvelut|duunipaikka|apuväline",
    re.I,
)

EMAIL = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
PHONE = re.compile(r"(?<!\d)(?:\+|00)?\d[\d\s().-]{7,}\d")
CONTACT_LINE = re.compile(
    r"(lisätietoja|lisätiedot|yhteyshenkilö|yhteydenotot|further information|more information|"
    r"contact (person|us)|for questions|kysymyksiin|rekrytoija|recruiter|soita|call )",
    re.I,
)


def is_agency(name: str) -> bool:
    return bool(AGENCY_PATTERN.search(name or ""))


def parse_listing(html: str, category: str) -> list[dict]:
    soup = BeautifulSoup(html, "lxml")
    out = []
    for a in soup.select("a.recruiter-job-link"):
        content = a.find_parent("div", class_="job__content")
        if content is None:
            continue
        comp = content.select_one(".recruiter-company-profile-job-organization")
        loc = content.select_one(".location")
        date = content.select_one(".date")
        href = a["href"]
        out.append({
            "url": href if href.startswith("http") else BASE + href,
            "title": a.get_text(strip=True),
            "company": comp.get_text(strip=True) if comp else "",
            "location": loc.get_text(strip=True) if loc else "",
            "listing_date": date.get_text(strip=True).rstrip(",") if date else "",
            "site_category": category,
        })
    return out


def clean_text(raw_html: str) -> str:
    """HTML -> plain text. Drops scripts, the auto 'summary' block, contact lines, emails, phones."""
    soup = BeautifulSoup(raw_html, "lxml")
    for t in soup(["script", "style", "center", "hr"]):
        t.decompose()
    for br in soup.find_all("br"):
        br.replace_with("\n")
    for el in soup.find_all(["li", "p", "div", "h1", "h2", "h3", "h4"]):
        el.append("\n")
    lines = [re.sub(r"[ \t\xa0]+", " ", ln).strip() for ln in soup.get_text().splitlines()]
    lines = [ln for ln in lines if ln and not CONTACT_LINE.search(ln)]
    text = "\n".join(lines)
    text = EMAIL.sub("", text)
    text = PHONE.sub("", text)
    return re.sub(r"\n{2,}", "\n", text).strip()


def parse_ad(html: str, url: str, hint: dict) -> dict | None:
    soup = BeautifulSoup(html, "lxml")
    posting = None
    for s in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(s.string or "")
        except json.JSONDecodeError:
            continue
        if isinstance(data, dict) and data.get("@type") == "JobPosting":
            posting = data
            break
    if not posting:
        return None
    org = posting.get("hiringOrganization") or {}
    locs = posting.get("jobLocation") or []
    if isinstance(locs, dict):
        locs = [locs]
    cities = [l.get("address", {}).get("addressLocality", "") for l in locs]
    return {
        "id": hashlib.sha1(url.encode()).hexdigest()[:12],
        "source": "jobly.fi",
        "url": url,
        "scraped_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "posted_date": posting.get("datePosted"),
        "company_name": (org.get("name") or hint.get("company") or "").strip(),
        "job_title": (posting.get("title") or hint.get("title") or "").strip(),
        "location": ", ".join(c for c in cities if c) or hint.get("location", ""),
        "site_category": hint.get("site_category", ""),
        "description_raw": clean_text(posting.get("description") or ""),
    }


def _save_index(index):
    (DATA / "jobly_index.json").write_text(json.dumps(index, ensure_ascii=False, indent=1))
    print("index size:", len(index))


def discover(pages: int):
    f = PoliteFetcher("jobly")
    seen, index = set(), []
    for slug, cat in CATEGORIES:
        for p in range(pages):
            url = f"{BASE}/tyopaikat/{slug}" + (f"?page={p}" if p else "")
            try:
                html = f.get(url)
            except Blocked as e:
                print("BLOCKED, stopping:", e)
                return _save_index(index)
            except Exception as e:  # 404 on unknown slug etc.
                print("skip", url, type(e).__name__)
                break
            items = parse_listing(html, cat)
            new = [i for i in items if i["url"] not in seen and i["company"] and not is_agency(i["company"])]
            seen.update(i["url"] for i in items)
            index.extend(new)
            print(f"{slug} p{p}: {len(items)} ads, {len(new)} kept (net calls {f.network_calls})", flush=True)
            if not items:
                break
        _save_index(index)


def fetch_ads(limit: int):
    f = PoliteFetcher("jobly")
    index = json.loads((DATA / "jobly_index.json").read_text())
    out_path = DATA / "jobs_raw.json"
    jobs = {j["url"]: j for j in json.loads(out_path.read_text())} if out_path.exists() else {}
    todo = [i for i in index if i["url"] not in jobs][:limit]
    for n, hint in enumerate(todo, 1):
        try:
            html = f.get(hint["url"])
        except Blocked as e:
            print("BLOCKED, stopping:", e)
            break
        except Exception as e:
            print("skip", hint["url"], type(e).__name__)
            continue
        job = parse_ad(html, hint["url"], hint)
        if job:
            jobs[job["url"]] = job
        print(f"[{n}/{len(todo)}] {hint['company']} | {hint['title']}", flush=True)
        if n % 10 == 0:
            out_path.write_text(json.dumps(list(jobs.values()), ensure_ascii=False, indent=1))
    out_path.write_text(json.dumps(list(jobs.values()), ensure_ascii=False, indent=1))
    print("saved", len(jobs), "ads")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["discover", "fetch"])
    ap.add_argument("--pages", type=int, default=3)
    ap.add_argument("--limit", type=int, default=10)
    a = ap.parse_args()
    discover(a.pages) if a.cmd == "discover" else fetch_ads(a.limit)

