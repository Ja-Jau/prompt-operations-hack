# Efficiency data for Higher or lower

The game uses six sourced observations: revenue, revenue growth, growth vs headcount, repetitive tasks in job ads, administrative expenses and time holding stock. Its company catalog grows automatically;
there is no fixed company universe in `companies.csv`.

## Game data and images

Higher or lower loads precomputed observations from `src/data/efficiency.json`,
joined to the discovered catalog in `src/data/game_companies.json`. No metrics
are fetched during play. The scheduled pipeline below refreshes these snapshots.

Each company in play has its own background photo showing what it does (a cell
tower for Nokia, a refinery for Neste, a forest harvester for Ponsse). The photos are
reviewed Wikimedia Commons files listed in `data/company_photos.json`, downloaded by
`python pipeline/fetch_company_photos.py` into `public/images/company/` and credited
in `public/images/credits.json`. Companies without one fall back to a credited
industry photo, labelled as such.

## Automatic refresh

`.github/workflows/refresh-company-data.yml` runs every six hours (00:23, 06:23,
12:23 and 18:23 UTC) and supports GitHub's **Run workflow** button. The workflow
must be present on the repository's default branch for scheduling to start.
GitHub Actions must be enabled and allowed to write repository contents. Protected
branches may need a bot exception. Scheduled runs can be delayed by GitHub.

The routine:

1. Downloads the previous calendar year's annual index from
   [XBRL International](https://filings.xbrl.org/docs/api). It discovers Finnish
   issuers, legal names, LEIs and report links. It selects December year ends and
   prefers valid English filings, then the most recently processed report.
2. Reads Jobly's general listing and eleven category listings. It revisits page one
   for new employers and advances a saved cursor through deeper pages. These are
   source categories, not preselected employers. Exact employer identity is retained;
   an agency posting is attributed to the agency, never its undisclosed client.
3. Refreshes the 40 least recently attempted companies, including failed attempts,
   so repeated failures cannot starve the rest. Each company gets a bounded job-ad
   sample and, where available, a tagged financial report. The queue keeps rotating
   as new companies enter; a large catalog takes several runs to refresh fully.
4. Recalculates observations for the entire catalog, validates the results, and
   commits only generated data to `main`. A connected Git deployment can publish
   the new snapshot. Players load this automatically maintained snapshot rather
   than waiting for scraping while playing.

No API keys or new Python packages are required (Python 3.11+). A local process lock
and GitHub concurrency group prevent overlapping routine runs. Network downloads
are cached; financial cache lifetime is seven days, listings one day. Conditional
requests reuse unchanged files where Last-Modified is available. Job requests have
configurable spacing and stop for the run on access/rate-limit responses.

```sh
npm run data:refresh                     # automatic discovery + next batch
npm run data:refresh -- --batch-size 80   # larger batch
npm run data:sample -- --company harvia   # focused refresh, no discovery
npm run data:financials                  # catalog reports + export
npm run data:build                       # offline export; no scraping
```

Refresh health, batches, timestamps, discovery errors and metric counts are saved
in `data/refresh_status.json`; workflow runs also upload coverage as an artifact.
A network failure preserves previous raw records with their original dates. Expired
job samples (90 days), expired job ads, and financial records for another fiscal year
are excluded from observations. Missing data never becomes an invented zero.

The catalog bootstraps old company artwork on its first run, then is maintained
independently. Reviewed `report_sources.json` mappings supplement automatically
indexed reports; they do not determine which companies can enter the catalog.
Public data cannot supply all six metrics for every employer. Missing disclosures
remain in the coverage report and those companies skip the affected category.

## Files and provenance

| File | Purpose |
| --- | --- |
| `data/company_catalog.json` | Discovered employer identities, provenance and first/last seen times |
| `data/discovered_reports.json` | Indexed report URLs and issuer LEIs |
| `data/discovery_state.json` | Listing-page cursors and discovery health |
| `data/refresh_status.json` | Batch queue attempts and refresh health |
| `../src/data/game_companies.json` | Game metadata exported from the discovered catalog |
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

- **Revenue (EUR):** reported revenue for the financial year, from the annual report.
- **Revenue growth (%):** `100 × (revenue / previousRevenue - 1)`, both years from
  the same report and reporting entity.
- **Growth gap (percentage points):**
  `100 × [(revenue / previousRevenue - 1) - (employees / previousEmployees - 1)]`.
  Both years come from the same report and reporting entity. Average headcount,
  average full-time equivalents, and closing headcount remain different definitions
  and cannot face each other in a question.
- **Repetitive-task ad share (%):** distinct ads matching the documented explicit
  task rules / all distinct non-empty sampled ads × 100. At least three ads,
  sampled within 90 days. Terms such as Excel or ERP alone do not qualify. Negated
  tasks and sentences about automating them are excluded. Exact matching sentences
  are retained, and every denominator ad has a source link. A sample where no rule
  matched is left out of the game rather than shown as 0%: with only a handful of
  ads it proves little. This rules-based
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
entity. Reviewed sources and XBRL International’s indexed filings are the financial source boundary.
Indexed report facts must match the discovered issuer LEI.

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
trap a chain in one category because questions use independent pairs. The default
run has five fresh random questions, and wrong guesses do not end the run.
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
