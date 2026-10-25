# Firmle

**A daily case game for Finnish business people, built from real job ads, that turns players into Velho conversations.**

*Prompt Operations Hackathon · Velho challenge · Startup Sauna, Espoo, 24–25 Oct 2026*

> **For judges, in 30 seconds.** Velho frees people from manual, repetitive work. Its buyers
> are CEOs, CFOs and COOs, who ignore ads and cold email. Finnish companies publish where
> their time goes every day without meaning to: in their **job ads**, with lines like
> "update the price lists in Excel" or "enter orders into the ERP".
>
> **Firmle** (like Wordle, but for firms) makes that into a daily puzzle. Read quotes from real open job ads and
> guess which of nine Finnish companies posted them. The reveal shows how much of that
> company's hiring is work software could take over, and how Velho would fix it. Players
> share their result, and the people who play are the people Velho wants to meet.
> Behind the game, Velho gets a **signals dashboard**: which companies are hiring for routine
> work right now, a one-page brief for each one, and the leads the game collected.

---

## Quick setup

You need **Node.js 20+** and npm. No API keys are needed to play.

```bash
git clone https://github.com/Ja-Jau/prompt-operations-hack.git
cd prompt-operations-hack
npm install
npm run dev
```

Then open:

| URL | What it is |
|---|---|
| http://localhost:3000 | **Firmle**: today's case (the main game) |
`destia-oy`, `terveystalo`) |

Higher or lower, the bonus game, is in the top bar.

**Optional:** copy `.env.example` to `.env.local` and fill in what you need (see
[Environment variables](#environment-variables)). The website itself needs no keys.

**Troubleshooting**
- `Module not found` after a `git pull`: run `npm install` again, a teammate added a package.
- Port 3000 is in use: `npm run dev -- -p 3001`.
- Want a clean start? Open a private window. Progress and the "how to play" popup are kept
  in local storage.

---

## The problem

Velho needs to be **seen** by senior operations and finance leaders at established Finnish
companies, and to get **into the room** with them, without cold outreach and without publishing
anything in Velho's name before Velho approves it.

## The idea

Every job ad is a public statement of where a company spends people's time. When an ad asks
someone to copy figures between systems every month, that company has just told the world it
has the exact problem Velho solves, and that it is about to pay a salary for it.

So we built two things on one dataset:

1. **For the audience, a game.** A daily, shareable puzzle about companies people in Finnish
   business know. It is fun on its own and makes Velho's point without reading like an ad.
2. **For Velho, a signal.** The same data, ranked: who is hiring for routine work now, what
   they would fix first, and a ready brief to open the conversation with.

## How to play

1. Read the clue: a quote from a real, open job ad, with the company name taken out.
2. Pick the company from **nine cards**. You have **five picks**.
3. Each wrong pick tells you something (for example "Answer also hires in Tampere") and
   unlocks the next clue: the jobs they're hiring for, the cities, and finally the first letter
   of the name. Quotes and job titles are translated into English.
4. Stuck? Use the **Velho hint** once per case for a free clue.
5. The reveal shows the company, how many of its open ads describe work software could take
   over, and what Velho would do about it. Share your result, or play another case.

There is one case per day, the same for everyone, plus unlimited practice cases. The share
text gives nothing away:

```
Firmle Case No. 12
Solved in 3/5
○ ● ✓
https://…
```

## Higher or lower

The bonus game compares revenue growth versus employee growth, repetitive tasks in sampled
job ads, administrative expenses as a share of revenue, and estimated inventory days.
Each play has five rounds with fresh random categories and sourced, comparable company
figures. Wrong guesses do not end the game; the result is a score out of five.
Switch to **Endless** for unlimited random rounds, including after wrong guesses; select
**Finish** to see and share your score. Each mode tracks its own best score.
Sources and tips open in dialogs so the game fits on one page.

Run `npm run data:refresh` locally to discover companies and refresh their data.
Higher or lower uses the committed dataset; it has no scheduled refresh workflow. The company pool grows
from the public Finnish filing index and Jobly listings rather than a fixed list. See the
[efficiency data guide](pipeline/EFFICIENCY.md) for definitions, coverage and validation.
Missing disclosures are excluded from play. `src/data/efficiency.json` supplies these
metrics; `src/data/game_companies.json` supplies automatically discovered company metadata.

## POV: You are the CEO

A first-person boardroom game in the top navigation: sit at the head of the table while
the COO presents live questions and choices on the projector. Five fictional business decisions, three choices
per question, and a 20-second timer bar under the choices. Pick the process improvement
before the clock runs out. Wrong answers and timeouts reveal the better move and let you
continue. Each play shuffles the scenarios and answer positions. The result shows your
score, personal best and a link to velho.io.

Scenarios live in `src/lib/ceo/scenarios.ts`; timing and grading rules are in
`src/lib/ceo/game.ts`. The timer starts when you select **Start the board meeting**. The fictional board-confidence
meter responds to decisions, presenter captions explain outcomes, and the room gains a
warning glow in the final ten seconds. The generated backdrop is stored locally at
`public/images/ceo/boardroom.webp`; all questions and choices remain interactive HTML.

## How it gets Velho into the room

| Step | What happens | Where in the code |
|---|---|---|
| **Seen** | A daily puzzle about familiar companies, shared as a spoiler-free result. Velho can post each case on LinkedIn, and the dashboard drafts that post. | `WhosHiring.tsx`, `caseShareText`, `linkedInPost` |
| **Understood** | Every reveal is a small Velho case study: real quotes, the share of routine-work ads, the first thing to fix and which Velho service fixes it. | `CaseReveal.tsx`, `pipeline/data/curated_signals.json` |
| **Invited** | "Want this analysis for your company?" Leaving a name and email on a reveal or a brief creates a lead. Nobody is cold-contacted, because the player asks first. | `LeadForm.tsx`, `/api/leads` |
| **In the room** | The dashboard ranks companies by how much of their hiring is routine work. Each one gets a printable CEO brief built only from its own public ads, plus a draft opener. Velho decides whether to use it. | `/velho`, `/brief/[id]`, `src/lib/signals.ts` |

## Outreach desk (demo)

`/outreach` is Velho's side of the funnel turned proactive: instead of waiting for players to
leave a lead, it finds the companies worth inviting to play and drafts the invitation.

| Step | What it does | Where in the code |
|---|---|---|
| **1. Find targets** | Scores every hiring company on routine-work ads, share, breadth (cities, functions) and whether Velho's take is ready. Staffing agencies are flagged and de-prioritised because their ads describe clients' work. | `src/lib/outreach/targets.ts` |
| **2. Compile** | Quotes, locations, functions, the first fix and the brief link, per company. | `src/app/outreach/page.tsx` |
| **3. Resolve contacts** | Domain from the pipeline when known, otherwise *derived* from the name and labelled as such. Role inboxes only (`info@`, `talous@`, `hr@`…), never a guessed personal address, plus the decision-maker role to look up with a LinkedIn search. Every contact carries a confidence. | `src/lib/outreach/contacts.ts` |
| **4. Draft & send** | A proposal email that quotes the ad verbatim, links the game and the brief and asks for 30 minutes. Editable in the page. | `src/lib/outreach/email.ts`, `src/components/outreach/` |

**The Send button is a demo and sends nothing.** `POST /api/outreach` validates the drafts, waits
a moment so the batch visibly drains, and appends rows marked `simulated: true` to
`.data/outreach-log.json`. There is no SMTP client, mail API or mail library anywhere in the
project; `npm run test:outreach` fails if one is ever added to the outreach code or
`package.json`. A production version would hand each draft to a person at Velho for approval.

Like `/velho`, the outreach page requires the `admin` / `admin` dashboard login.

## Why the content can be trusted

Saying something wrong about a real company in front of its CEO is the one mistake this
product can't afford, so the data pipeline is strict:

- **Real data.** We scraped 222 job ads from Jobly.fi with `velho-game-data/scraper`, which
  respects robots.txt and is rate-limited. They come from 135 hiring companies. Sixteen of
  those have enough evidence to be daily cases, with 52 quotes between them.
- **Verbatim quotes only.** `pipeline/import_jobs.py` checks that every quote appears word
  for word in the ad it cites and **stops the build** if one doesn't, so no quote in the
  game can be made up.
- **Sources.** The CEO brief links every quote to the ad it came from.
- **Neutral framing.** The copy says "work software could take over", never "inefficient".
- **No sources we weren't allowed to use.** We don't use Duunitori's API, because its
  robots.txt disallows `/api/`.

## How we use Claude

Claude (`claude-opus-5-5`) does the reading and writing that would take an analyst days.
It runs **offline in the pipeline**, so the live demo never waits on an API.

| Where | What Claude does |
|---|---|
| `pipeline/build_cases.py` | For each case, writes Velho's take from the quotes only: the analyst hint, "what to fix first" options, which Velho service applies and an adoption note |
| `pipeline/build.py` | Writes the neutral "why" and hint lines for Higher or lower |

The curated quotes and Velho's takes for the 16 cases are in
`pipeline/data/curated_signals.json`, so a person can review them before they ship.

## Tech stack

| Part | Tech |
|---|---|
| App and API | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4 |
| Data pipeline | Python 3.11, Anthropic SDK, BeautifulSoup (scraper) |
| AI | Claude `claude-opus-5-5` |
| Data at runtime | Static JSON in `src/data/`, so the game can't break because an API is down |

The visual style follows velho.io: cream and navy, the Geist font, plain language.

Scraped HTML pages under `velho-game-data/data/raw/` are a local download cache,
ignored by Git. The scraper recreates them when needed; the website uses the
processed JSON in `src/data/`. Keep processed data committed, not downloaded pages.

## Project structure

```
src/
  app/
    page.tsx                  # the game (Firmle + Higher or lower)
    velho/page.tsx            # Velho's signals dashboard
    brief/[id]/page.tsx       # printable one-page CEO brief per company
    api/leads/route.ts        # POST: save a lead
    api/companies/route.ts    # GET: company data, where a live source would plug in
  components/
    case/                     # Firmle: game, clues, option cards, reveal, how to play
    game/                     # Higher or lower
    leads/LeadForm.tsx
    layout/                   # shared top bar, page title, game switcher
  lib/
    case/cases.ts             # daily case, clues, options, feedback, share text
    signals.ts                # dashboard ranking, draft opener, LinkedIn post
    leads.ts                  # lead storage
    velho.ts                  # Velho's service areas and link
  data/                       # generated by the pipeline, don't edit by hand
    hiring.json               #   companies with open ads (Firmle)
    companies.json            #   companies with revenue/headcount (Higher or lower)
pipeline/                     # Python, run before the demo, never during it
  import_jobs.py              #   scraped ads + curated quotes → src/data/hiring.json (verifies quotes)
  build_cases.py              #   Claude writes Velho's take per case
  build.py                    #   Higher or lower data → src/data/companies.json
  fetch_logos.py, fetch_images.py
  data/curated_signals.json   #   reviewed quotes and takes
velho-game-data/              # the Jobly.fi scraper and the raw ads
```

## Updating the data

The repo already includes the scraped ads and the generated JSON, so you only need this to
refresh the data.

```bash
pip install -r pipeline/requirements.txt

# 1. Scrape fresh ads (optional)
cd velho-game-data
pip install -r requirements.txt
python -m scraper.jobly discover --pages 3
python -m scraper.jobly fetch --limit 10
cd ..

# 2. Rebuild the game data
python pipeline/import_jobs.py      # stops if any quote isn't verbatim
python pipeline/build_cases.py      # optional: Claude rewrites Velho's takes (needs ANTHROPIC_API_KEY)
python pipeline/build.py --no-ai    # Company metadata
npm run data:refresh               # Sourced Higher or lower efficiency metrics
```

A company becomes a case once it has at least 2 verified quotes. That limit is
`MIN_CASE_QUOTES`, and it has to match in `import_jobs.py` and `cases.ts`.

## Environment variables

None are needed for local play.

| Variable | Used by | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | pipeline only | Claude, for the offline text. Not needed by the website. |
| `NEXT_PUBLIC_VELHO_URL` | web | Where every "Go to Velho" link points (default `https://velho.io/`) |
| `NEXT_PUBLIC_LOGO_DEV_TOKEN` | web | logo.dev key for sharper logos. Without it the app falls back to local files, then favicons, then initials. |
| `DASHBOARD_SESSION_SECRET` | dashboard | Optional signing key for the eight-hour dashboard login session. |
| `LOGO_DEV_TOKEN`, `UNSPLASH_ACCESS_KEY` | `fetch_logos.py`, `fetch_images.py` | Optional, for downloading logos and photos |

## Deploying to Vercel

1. **Add New → Project**, then pick this repo. Vercel detects three apps (`pipeline`,
   `velho-game-data`, `app`). Click **Import single project** on **app (Next.js)** only. The
   Python folders run offline and are not deployed.
2. Leave Root Directory as `./`, Framework as **Next.js**, and the build and install
   commands at their defaults.
3. Under **Environment Variables**, add:
   - `DASHBOARD_SESSION_SECRET`: optional deployment-specific session signing key.
   - `NEXT_PUBLIC_VELHO_URL`: optional, for example a campaign link to velho.io.
4. Click **Deploy**.

The game, the briefs and the dashboard all work on Vercel. **Saving leads doesn't**, because
leads go to `.data/leads.json` and Vercel's file system is read-only. On a deploy, the lead
form shows "Could not save right now". See [What isn't done yet](#what-isnt-done-yet).

## Demo script (3 minutes)

1. **Play.** Judges play today's case on their phones: read the quote, make a wrong pick, see
   the feedback and the next clue, then find the answer.
2. **Reveal.** Show how many of the company's open ads describe routine work, what Velho would
   fix first, and the lead form.
3. **Switch to Velho's side.** `/velho` ranks every hiring company by signal, shows the leads
   and drafts today's LinkedIn post.
4. **Open a brief.** `/brief/<id>` is a one-page note for that company's CEO, built only from
   its own public ads and ready to print.

## What isn't done yet

We'd rather say it than have you find it.

| Gap | Effect today | What it takes |
|---|---|---|
| **Lead storage when hosted** | Leads save locally, but not on Vercel (read-only file system). | Replace the two functions in `src/lib/leads.ts` with a KV store or a Google Sheet. Nothing else changes. |
| **"Rank your company" only knows the game's companies** | In Higher or lower, any other name gets "isn't in the game yet". The live AI lookup was removed to keep the site free of API keys. | Add companies to the dataset, or bring back a live lookup. |
| **Public metric coverage** | Higher or lower uses precomputed, sourced observations refreshed by the scheduled pipeline. Companies without disclosed inputs skip the affected category. | Add tested report adapters and additional job sources to expand coverage. |
| **Data is a snapshot** | 222 ads scraped once from Jobly.fi. Over time cases point to ads that have closed. | Run the scraper and `import_jobs.py` on a schedule, for example a nightly GitHub Action. |
| **Only 16 cases** | After 16 days the daily case repeats. | More scraping, and more quotes in `curated_signals.json`. `build_cases.py` drafts Velho's take, a person approves it. |
| **One job board** | Only Jobly.fi is used. Duunitori's API is off-limits by its robots.txt. | Add companies' own careers pages, which most large Finnish companies publish. |
| **No analytics** | We can't yet show how many people played, shared or converted. | A privacy-friendly counter (e.g. Plausible) on case start, solve, share and lead. |
| **Dashboard login** | `/velho/login` uses the shared demo credentials `admin` / `admin`, with an eight-hour signed session. | Individual accounts can replace the demo login later. |
| **Finnish ads, English game** | Quotes are in the language of the ad, the interface is in English. | A Finnish interface, since the audience is Finnish. |

## Ground rules and status

- This is a **prototype**. Nothing has been published in Velho's name and no real company has
  been contacted. The draft openers and posts are for Velho to review and decide whether to send.
- Everything Velho-facing, like the LinkedIn post and the openers, is a draft. Velho approves
  it before anything goes out.

### Marketing dashboard demo

Open `/velho` and sign in with username **admin** and password **admin**.
The login uses a signed, HTTP-only session cookie and supports sign-out.
`/outreach` and its demo-log API require the same session. Set
`DASHBOARD_SESSION_SECRET` for a deployment-specific signing key; the demo
works without additional configuration.

The priority pie chart counts companies (high / medium / watch). Click a legend
item to filter the five-row company list. Analyzed-company, flagged-ad and enquiry
counts are separate metrics. Email drafts remain editable until recorded; **Send demo** saves an invitation for
response tracking and never delivers an email.

### Game invitations and company responses

On `/velho`, email drafts invite companies to play Firmle, read their company brief, and explore improvements with Velho. The composer includes working game/contact/no-thanks links and a **Copy email** action that puts both HTML and plain text on the clipboard, preserving buttons when pasted into rich-text mail editors. **Download HTML** provides an export if rich clipboard access is unavailable. **Send demo** records an invitation only; it never delivers email. Open a response button from the composer to try the recipient flow. Opening a contact or no-thanks link in a browser records that choice through a POST from `/respond/[token]`, with visible save/error feedback. Game-link visits are recorded separately and do not imply interest in the service. Repeated clicks do not add duplicate responses, and recipients can change their preference.

`/velho/responses` requires the same admin login and shows interested, declined, and unanswered demo invitations in a pie chart and filterable table. The responses page fetches an authenticated, uncached `/api/velho/responses` snapshot every five seconds while visible and on window focus. Errors and the last-check time are shown. Counts represent invitations, not unique people. Untouched drafts are excluded; clicked draft previews are included and labelled as previews, without being marked as sent. A contact request records interest and the invitation’s recipient address for manual follow-up.

Invitations persist in Upstash Redis when the existing `KV_REST_API_URL`/`KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`) variables are configured. Otherwise they use `.data/invitations.json` for local demos. Deployments with read-only or ephemeral filesystems need Redis for persistence.

### Dashboard job-ad refresh

**Supabase + hourly background refresh:** `/velho` reads saved Jobly ad samples
from Supabase when `SUPABASE_URL` and `SUPABASE_SECRET_KEY` are configured. A separate
GitHub Actions worker fetches up to ten ads from a rotating category each hour,
without a browser visit or a running web server. Follow the
[database and secrets setup](supabase/README.md) to create the tables, configure
Vercel and GitHub, and run the first batch. Ads are updated by URL; failed batches
keep the previous data. Samples older than 30 days are excluded from rankings.
The **Fetch job ads** button reloads the latest saved ads from Supabase into the
dashboard. The hourly background worker collects new ads independently.
The company list includes every saved company, with flagged opportunities first;
use **Flagged only** to narrow it. Companies without keyword matches show **Needs
review**, and **View analysis** includes links to their saved job listings.

**Local mode (without Supabase):**

The dashboard can display bundled demo data and an existing `.data/dashboard-job-ads.json`
sample. **Fetch job ads** requires the Supabase variables in `.env.local`; otherwise it
shows a configuration message. The web app does not launch the Python scraper.
The independent worker flags explicit repetitive-task phrases and stores short verbatim
evidence for review. See the [worker setup](supabase/README.md) to run it manually.
