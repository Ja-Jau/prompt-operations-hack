# Tehokas

**Which Finnish company earns more per employee?** A daily higher/lower game built for the
Velho challenge at the Prompt Operations Hackathon (Startup Sauna, 24–25 Oct 2026).

Two real Finnish companies appear side by side. You guess whether the second one earns
**more or less revenue per employee** than the first. The number rolls up, you see *why*
(the business model behind it), and the next company slides in.

## Why this is marketing for Velho, without looking like marketing

Velho's problem is getting **seen** by the right people (CEOs, CFOs, COOs and heads of
operations at established companies) without cold outreach.

- **Revenue per employee is Velho's number.** Velho frees up people's time from manual work,
  which is exactly what raises this metric. Every reveal makes that point without an ad.
- **Real companies spread the game.** When Kone or Fazer shows up, their employees and their
  competitors share it.
- **"Where does YOUR company rank?"** After the game, players enter their own revenue and
  headcount. They see their percentile among peers, the gap to the top 25%, and roughly how
  many hours per person per week closing that gap means, with a link to Velho. A CEO
  checking their own company's rank is the warmest lead there is.
- **Shareable daily result:** the same 10 matchups for everyone each day, plus an emoji
  result that's easy to post:

  ```
  Tehokas #1 🇫🇮
  🟩🟩🟩🟥🟩🟩🟩🟩🟥🟩 8/10
  ⚡ used a Velho tip
  ```

## Features

| Status | Feature |
|---|---|
| ✅ | Daily challenge: 10 matchups, the same for everyone (seeded by date) |
| ✅ | Endless mode: play until your first wrong guess |
| ✅ | One-screen split layout: photo background per company, logo, VS badge that turns ✓/✗ |
| ✅ | Stats always visible (employees; revenue after the reveal), plus € per working hour |
| ✅ | Rolling-number reveal, plus a "Velho insight" for every company |
| ✅ | Result titles to share: from "Still in Manual Mode" to "Chief Efficiency Officer" |
| ✅ | ⚡ **Ask Velho** lifeline: one hint per game, Velho as the helpful expert |
| ✅ | Share result (copied to clipboard) |
| ✅ | "Where does your company rank?": type only a name, Claude + web search finds the figures, you land on the ladder with hours needed to overtake the next company |
| ✅ | Python data pipeline: validate figures, generate text with Claude, export JSON |
| ⏳ | Verified figures for every company, from annual reports |
| ⏳ | Live stats APIs behind `/api/companies` |
| ⏳ | Manual-work bonus cards ("Which company has more job ads describing manual Excel work?") |
| ⏳ | Rivalry matchups and theme days |
| ⏳ | Shareable result image (OG image) |

## Tech stack

| Part | Tech | Why |
|---|---|---|
| Game and API | **Next.js 15 (App Router), TypeScript, Tailwind CSS v4** | One app for the UI and the server routes; deploys to Vercel in a minute |
| Data pipeline | **Python 3.11 + Anthropic SDK** | Validates figures, has Claude write the "why" and hint text, exports JSON |
| AI | **Claude** (`claude-opus-5-5`) | Offline text generation, plus the live company lookup (web search) in `/api/lookup` |

The game itself runs on static JSON in the browser, so it can't break because an API is down.
Only the optional company lookup calls Claude live. Python runs **before** the demo, never during it.

## Project structure

```
pipeline/                     # Python: offline data work, never runs during the demo
  data/companies.csv          #   source of truth: figures, sources, verified flag, text
  data/industries.csv         #   photo search term per industry (fallback backgrounds)
  build.py                    #   validate → enrich with Claude → write src/data/companies.json
  fetch_logos.py              #   download logos into public/logos/
  fetch_images.py             #   download Unsplash background photos into public/images/
  requirements.txt
src/
  app/                        # Next.js routes
    page.tsx                  #   landing page (server component)
    layout.tsx, globals.css
    api/companies/route.ts    #   GET /api/companies: where live stats plug in
    api/lookup/route.ts       #   POST /api/lookup: Claude + web search finds a company's figures
  components/
    game/                     # the higher/lower game
      Game.tsx                #   game loop: daily + endless, guesses, lifeline, results
      CompanyPanel.tsx        #   one half of the split screen (photo, logo, stats)
      CompanyLogo.tsx         #   logo with fallbacks: local file → logo.dev → favicon → initials
      RollingNumber.tsx
    ranking/
      YourCompany.tsx         # "where does your company rank?" (lead capture)
  lib/
    data/companies.ts         # getCompanies(): the one place to swap in a live source
    game/
      rules.ts                #   revenue per employee, picking a fair next card
      daily.ts                #   seeded daily run, puzzle number
      random.ts               #   deterministic PRNG
      share.ts                #   emoji grid and share text
    ranking.ts                # place a company on the ladder, hours to overtake
    format.ts                 # € formatting
  types/company.ts            # Company, Mode and LookupResult types
  data/companies.json         # generated by the pipeline; do not edit by hand
```

## Getting started

```bash
npm install
npm install @anthropic-ai/sdk   # for /api/lookup
cp .env.example .env.local      # then fill in the keys
npm run dev                     # http://localhost:3000
```

### Updating company data

1. Edit `pipeline/data/companies.csv`. Use figures from the company's **annual report**,
   fill in `source_url`, and set `verified` to `true` once checked.
2. Rebuild the JSON:

   ```bash
   pip install -r pipeline/requirements.txt
   python pipeline/build.py          # fills missing why/hint with Claude
   python pipeline/build.py --no-ai  # validate + export only
   ```

   Claude needs credentials: `ANTHROPIC_API_KEY`, or a profile from `ant auth login`.

### Logos

```bash
python pipeline/fetch_logos.py   # downloads into public/logos/<id>.png
python pipeline/build.py --no-ai # links them into the game data
```

Without downloaded files, the game falls back to logo.dev (if
`NEXT_PUBLIC_LOGO_DEV_TOKEN` is set) or Google favicons live in the browser.

Set `LOGO_DEV_TOKEN` (free at logo.dev) for sharp logos; without it the script falls back to
Google's favicon service. For the best look, put an official press-kit logo at
`public/logos/<id>.svg`, which beats a downloaded `.png`. Companies without a logo show their
initials on their brand colour (`brand_color` in the CSV).

### Background photos

```bash
python pipeline/fetch_images.py                    # industry fallbacks + per-company photos
python pipeline/fetch_images.py --industries-only  # just the 12 industry fallbacks
python pipeline/build.py --no-ai                   # link them into the game data
```

Every company shows its own photo (`image_query` in `companies.csv`) or, failing that, its
industry's photo (`pipeline/data/industries.csv`). The script uses Unsplash when
`UNSPLASH_ACCESS_KEY` is set and Wikimedia Commons (no key needed) otherwise, and only takes
freely licensed photos. Credits are stored in `public/images/credits.json` and shown on screen.

The build stops if a row is missing data or its revenue per employee is outside a sane
range (a typical sign of entering € instead of €M). It also lists every company that isn't
verified yet.

> ⚠️ **The seed figures are approximate and unverified.** Check every company against its
> latest annual report before the demo. A wrong number about a real company is the one
> thing that would hurt us in front of the judges.

### Environment variables

| Variable | Used by | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | pipeline, `/api/lookup` | Claude text generation and the live company lookup |
| `NEXT_PUBLIC_LOGO_DEV_TOKEN` | web | logo.dev publishable key, for sharp live logos |
| `NEXT_PUBLIC_VELHO_URL` | web | Where the "Find those hours with Velho" button links |
| `LOGO_DEV_TOKEN` | `fetch_logos.py` | Same logo.dev key, for downloading logos |
| `UNSPLASH_ACCESS_KEY` | `fetch_images.py` | Optional: Unsplash photos instead of Wikimedia Commons |

## Demo script (5 minutes)

1. Judges play the daily challenge on their own phones (about 2 minutes).
2. Show the reveal, the "why" line and the shared result.
3. A judge types their own company's name; Claude finds the figures and places it on the ladder.
4. Show the pipeline: CSV → validation → Claude-written text → game.

## Ground rules (from the Velho brief)

- Don't contact real companies, and don't publish anything in Velho's name without
  checking with Velho first. Until then, Tehokas is a prototype.
- Keep the framing about real companies neutral and factual, and cite sources.
