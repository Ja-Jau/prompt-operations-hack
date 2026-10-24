# Efficiency data for Higher or lower

The game uses four sourced observations, never the placeholder financial figures in
`companies.csv`. All companies in that CSV are processed. Availability differs by
company: a company without a disclosure or enough ads stays in the coverage report
but cannot appear in a question for that metric. Public data cannot provide every
metric for every company.

## Refresh

No new Python packages or API credentials are required (Python 3.11+).

```sh
npm run data:refresh       # fresh Jobly samples + official financial reports + export
npm run data:financials    # financial reports + existing job samples + export
npm run data:build         # offline rebuild from saved facts and sampled ads
```

Run the full refresh weekly on a machine with network access. It uses a configurable
0.25-second interval between job-source requests, rather than the site's advertised
crawl delay. Review the generated
coverage and data diff before committing the new snapshot. The website continues
using the committed snapshot while sources are unavailable; gameplay makes no
live research requests.

Useful options:

```sh
python3 pipeline/fetch_efficiency.py --company harvia --force
python3 pipeline/fetch_efficiency.py --year 2025 --strict
python3 pipeline/fetch_efficiency.py --company valmet --refresh-jobs
python3 pipeline/fetch_efficiency.py --refresh-jobs --job-delay 0.1
```

`--company` limits network refreshes, while the export always contains every
configured company. `--force` bypasses the seven-day financial download cache.
`--strict` fails when a category has fewer than two observations; game tests also
check that each category actually has an eligible pair. The fiscal year defaults
to the previous calendar year. This importer intentionally supports full
January–December years; other reporting calendars need an explicit extension.

## Files and provenance

| File | Purpose |
| --- | --- |
| `data/report_sources.json` | Official report landing pages, optional direct `reportUrl`, reviewed concept/table mappings, employer aliases |
| `data/financial_facts.json` | Downloaded financial inputs, exact XBRL concept/context, legal-entity identifier, report URL, retrieval time |
| `data/job_samples.json` | Refreshed ads, source URLs, original sampling times, per-company scrape errors |
| `data/efficiency_coverage.json` | Availability/missing reasons and report errors for every company |
| `../src/data/efficiency.json` | Calculated game observations, inputs, definitions, sources, dates and limitations |
| `.cache/efficiency/` | Ignored report downloads and numeric concept inventories, useful for inspecting new filings |

Until a company has a refreshed Jobly sample, its previously scraped ads in
`velho-game-data/data/jobs_raw.json` are used. These came from selected job
categories, so they are not a representative census of the employer's vacancies.
Every ad in either input sample is classified; curated positive quotes never
determine the denominator. A refresh with no matching ads produces missing data,
not zero percent. On a network error a still-recent previous sample can be retained
with its original date. The error remains in `job_samples.json`.

## Definitions

- **Growth gap (percentage points):**
  `100 × [(revenue / previousRevenue - 1) - (employees / previousEmployees - 1)]`.
  Both years come from the same report and reporting entity. Average headcount,
  average full-time equivalents, and closing headcount remain different definitions
  and cannot face each other in a question.
- **Repetitive-task ad share (%):** distinct ads matching the documented explicit
  task rules / all distinct non-empty sampled ads × 100. At least three ads,
  sampled within 90 days. Terms such as Excel or ERP alone do not qualify. Negated
  tasks and sentences about automating them are excluded. Exact matching sentences
  are retained, and every denominator ad has a source link. Zero means no rule
  matched, not proof that the company has no repetitive work. This rules-based
  classifier prioritises precision and can miss differently worded tasks.
- **Admin ratio (%):** absolute separately reported administrative expenses /
  revenue × 100. Combined SG&A, total operating expenses and payroll are not
  substitutes.
- **Inventory days:** average opening and closing inventory / absolute annual
  cost of sales × actual days in the year. Closing inventory alone, purchases and
  material expense are not substitutes for these inputs. No inventory/cost-of-sales
  disclosure means unavailable, which is normal for many service companies.

These figures are process signals, not proof of waste. Industries, accounting
policies, acquisitions, inflation, outsourcing and seasonality affect comparisons.
The reveal explains each measure and links to the evidence.

## Financial extraction

`fetch_efficiency.py` discovers ESEF ZIP/XHTML attachments on the configured official
report pages, with a bounded follow of report subpages. `esef.py` reads numeric
iXBRL or XBRL facts using their scale, sign, format, unit and reporting context.
Segment/subsidiary contexts, conflicting duplicates, unsupported transforms and
non-EUR facts are rejected. Financial inputs must belong to one legal reporting
entity. The source catalog is the trust boundary; add official sources only.

Employee counts are often not numeric XBRL facts. `employeeTable` mappings select
an exact reviewed row and optional `tableContains` text, align values to year
headers in that same table, and reject conflicting matches. Keep these mappings
specific enough to exclude segment and parent-company tables. An importer can
also use a reviewed `employees.concepts` list and employee basis for numeric tags.

Private companies, image-based reports and reports containing only unsupported
PDF layouts may remain unavailable. There is deliberately no AI guess or silent
fallback to the old CSV. For more coverage, add an official tagged report or a
tested extraction adapter. Some landing URLs are year-specific announcements;
update those entries when moving to another fiscal year. A changed format should
produce missing data rather than a guessed figure.

## Question selection

`src/lib/game/sequence.ts` enumerates comparable pairs for each category. Pairs
must have the same fiscal year, scope and metric definition. Job-ad sampling dates
must be within 30 days. Minimum gaps avoid ties after display rounding.

Each new question selects a category uniformly, then a pair. When possible it
changes category from the previous question. A company with missing data cannot
trap a chain in one category because questions use independent pairs. The daily
run contains up to ten date-seeded questions with no repeated category/pair.
Endless uses fresh randomness and avoids the last five pairs when coverage permits.

## Validation

```sh
npm run test:data
npm run test:game
```

Tests cover numeric units/scales/signs, excluded segments, conflicting facts,
table year ordering, growth and inventory formulas, missing disclosures, employer
identity, duplicate/stale ads, task classification, equal category sampling,
deterministic daily questions, sparse endless data and actual exported coverage.
