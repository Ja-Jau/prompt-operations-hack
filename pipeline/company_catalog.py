"""Discover companies from XBRL International's annual index and live Jobly listings."""
from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import re
import unicodedata
from urllib.parse import urljoin, urlparse

from efficiency_data import employer_key
from fetch_efficiency import ROOT, fetch, read_json, write_json

CATALOG_PATH = ROOT / 'pipeline/data/company_catalog.json'
SOURCES_PATH = ROOT / 'pipeline/data/discovered_reports.json'
STATE_PATH = ROOT / 'pipeline/data/discovery_state.json'
XBRL = 'https://filings.xbrl.org'
# Source categories, not a list of companies. New employers are discovered every run.
CATEGORIES = ['', 'hallinto-ja-toimistotyo', 'talous-ja-rahoitus', 'asiakaspalvelu',
              'kuljetus-ja-logistiikka', 'osto-ja-hankinta', 'henkilostohallinto',
              'projektihallinto', 'myynti', 'teollisuus', 'vahittais-ja-tukkukauppa', 'it']


def timestamp():
    return datetime.now(timezone.utc).isoformat()


def company_id(name: str) -> str:
    key = employer_key(name)
    slug = re.sub(r'[^a-z0-9]+', '-', unicodedata.normalize('NFKD', key).encode('ascii', 'ignore').decode().lower()).strip('-')
    return f'{slug[:60] or "company"}-{hashlib.sha256(key.encode()).hexdigest()[:8]}'


def load_catalog() -> list[dict]:
    saved = read_json(CATALOG_PATH, None)
    if saved is None:
        # One-time migration keeps artwork and reviewed identities, not a fixed universe.
        saved = [{k: c[k] for k in ('id', 'name', 'industry', 'domain', 'brandColor', 'logo', 'image', 'imageCredit', 'hint')}
                 for c in read_json(ROOT / 'src/data/companies.json', [])]
    financials = read_json(ROOT / 'pipeline/data/financial_facts.json', {})
    for company in saved:
        entities = {f['entity'] for f in financials.get(company['id'], {}).get('facts', {}).values() if f}
        if len(entities) == 1 and re.fullmatch(r'[A-Z0-9]{20}', next(iter(entities))):
            company['lei'] = next(iter(entities))
    # A familiar display name and a legal filing name can differ. LEI, not fuzzy names,
    # joins them, ensuring the game cannot compare two identities of the same issuer.
    result, by_lei = [], {}
    for company in sorted(saved, key=lambda c: (c['id'] not in financials, c['id'])):
        lei = company.get('lei')
        if lei and lei in by_lei:
            canonical = by_lei[lei]
            for field in ('discoverySources', 'listingUrls'):
                canonical[field] = list(dict.fromkeys([*canonical.get(field, []), *company.get(field, [])]))
            continue
        result.append(company)
        if lei:
            by_lei[lei] = company
    return result


def upsert(catalog: list[dict], name: str, source_url: str, seen_at: str, *, lei: str | None = None) -> dict:
    if not name.strip() or not employer_key(name):
        raise ValueError('Empty employer identity')
    reviewed = read_json(ROOT / 'pipeline/data/report_sources.json', {})
    matches = [c for c in catalog if (lei and c.get('lei') == lei) or
               (not (lei and c.get('lei') and c['lei'] != lei) and
                employer_key(name) in {employer_key(c['name']), *(employer_key(n) for n in reviewed.get(c['id'], {}).get('jobNames', []))})]
    if len(matches) > 1:
        raise ValueError(f'Ambiguous company identity: {name}')
    if matches:
        company = matches[0]
    else:
        cid = f'lei-{lei.lower()}' if lei else company_id(name)
        company = {'id': cid, 'name': name.strip(), 'industry': 'Public-source company',
                   'domain': None, 'brandColor': '#18344c', 'logo': None, 'image': None,
                   'imageCredit': None, 'hint': 'Compare the sourced figures and the definition of this category.',
                   'firstSeenAt': seen_at}
        catalog.append(company)
    company['lastSeenAt'] = seen_at
    company.setdefault('discoverySources', [])
    if source_url not in company['discoverySources']:
        company['discoverySources'].append(source_url)
    if lei:
        company['lei'] = lei
    return company


def index_reports(document: dict, year: int, country: str = 'FI') -> list[dict]:
    entities = {e['id']: e['attributes'] for e in document.get('included', []) if e.get('type') == 'entity'}
    grouped = {}
    for row in document.get('data', []):
        attr = row['attributes']
        # Current importer supports January–December reports, with EUR facts only.
        if attr.get('country') != country or attr.get('period_end') != f'{year}-12-31':
            continue
        relation = row.get('relationships', {}).get('entity', {})
        entity = entities.get(relation.get('data', {}).get('id'))
        if not entity or not entity.get('name') or not re.fullmatch(r'[A-Z0-9]{20}', entity.get('identifier', '')):
            continue
        path = attr.get('report_url') or attr.get('package_url')
        url = urljoin(XBRL, path or '')
        if not path or urlparse(url).netloc != 'filings.xbrl.org' or urlparse(url).scheme != 'https':
            continue
        item = {'name': entity['name'], 'lei': entity['identifier'], 'reportUrl': url, 'reportYear': year,
                'indexUrl': f'{XBRL}/indexes/filings-{year}.json', 'processed': attr.get('processed') or '',
                'english': bool(re.search(r'[-/]en[/.\-]', path)), 'errors': attr.get('error_count') or 0}
        grouped.setdefault(item['lei'], []).append(item)
    # Prefer valid English filings, then most recently processed. No inference from directory numbering.
    return [sorted(items, key=lambda r: (r['errors'] == 0, r['english'], r['processed']), reverse=True)[0]
            for _, items in sorted(grouped.items())]


def discover_companies(year: int, listing_pages: int = 2) -> dict:
    from fetch_job_samples import BASE, Listing, SourceClient
    import json
    catalog = load_catalog()
    reports = read_json(SOURCES_PATH, {})
    state = read_json(STATE_PATH, {'cursors': {}})
    errors, discovered = [], 0
    try:
        body, seen_at = fetch(f'{XBRL}/indexes/filings-{year}.json', max_age_days=1)
        for report in index_reports(json.loads(body), year):
            company = upsert(catalog, report['name'], report['indexUrl'], seen_at, lei=report['lei'])
            reports[company['id']] = {k: report[k] for k in ('reportUrl', 'reportYear', 'lei', 'indexUrl')}
            discovered += 1
    except (OSError, ValueError) as exc:
        errors.append(f'Filing discovery: {exc}')
    # Rotate through deeper pages, while also revisiting the first page for new ads.
    client = SourceClient()
    for category in CATEGORIES:
        base = BASE + '/tyopaikat' + ('/' + category if category else '')
        cursor = state.setdefault('cursors', {}).get(category, 1)
        pages = [0, *range(cursor, cursor + listing_pages - 1)]
        try:
            for page in pages:
                body, seen_at = client.get(base + (f'?page={page}' if page else ''))
                listing = Listing()
                listing.feed(body.decode('utf-8', errors='replace'))
                if not listing.items:
                    cursor = 1
                    break
                for url, employer in listing.items:
                    if not employer.strip():
                        continue
                    company = upsert(catalog, employer, base, seen_at)
                    company.setdefault('listingUrls', [])
                    if url not in company['listingUrls']:
                        company['listingUrls'] = [*company['listingUrls'], url][-24:]
                cursor = page + 1 if page else cursor
            state['cursors'][category] = cursor
        except (OSError, ValueError) as exc:
            errors.append(f'{base}: {exc}')
            if getattr(exc, 'code', None) in (401, 403, 429):
                break
    write_json(CATALOG_PATH, sorted(catalog, key=lambda c: c['id']))
    write_json(SOURCES_PATH, reports)
    state.update({'lastRunAt': timestamp(), 'companyCount': len(catalog), 'filingCompanies': discovered, 'errors': errors})
    write_json(STATE_PATH, state)
    print(f'Discovery: {len(catalog)} companies; {discovered} filing issuers; {len(errors)} source errors', flush=True)
    return state
