# Who's hiring?

**A daily case game for Finnish business people, built from real job ads, that turns players into Velho conversations.**

*Prompt Operations Hackathon · Velho challenge · Startup Sauna, Espoo, 24–25 Oct 2026*

> **For judges, in 30 seconds.** Velho frees people from manual, repetitive work. Its buyers
> are CEOs, CFOs and COOs, who ignore ads and cold email. Finnish companies publish where
> their time goes every day without meaning to: in their **job ads**, with lines like
> "update the price lists in Excel" or "enter orders into the ERP".
>
> **Who's hiring?** makes that into a daily puzzle. Read quotes from real open job ads and
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
| http://localhost:3000 | **Who's hiring?**: today's case (the main game) |
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

1. Read the clue: a verbatim quote from a real, open job ad, with the company name blanked.
2. Pick the company from **nine cards**. You have **six picks**.
3. Each wrong pick tells you something (for example "Answer also hires in Tampere") and
   unlocks the next clue: the hiring map, a second quote, the job functions, an analyst note.
4. Stuck? Use the **Velho hint** once per case for a free clue.
5. The reveal shows the company, how many of its open ads describe work software could take
   over, and what Velho would do about it. Share your result, or play another case.

There is one case per day, the same for everyone, plus unlimited practice cases. The share
text gives nothing away:

```
Who's hiring? Case No. 12
Solved in 3/6
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

A GitHub Actions workflow discovers companies and refreshes a rotating batch every six
hours. Run `npm run data:refresh` locally for the same routine. The company pool grows
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

## Project structure

```
src/
  app/
    page.tsx                  # the game (Who's hiring? + Higher or lower)
    velho/page.tsx            # Velho's signals dashboard
    brief/[id]/page.tsx       # printable one-page CEO brief per company
    api/leads/route.ts        # POST: save a lead
    api/companies/route.ts    # GET: company data, where a live source would plug in
  components/
    case/                     # Who's hiring?: game, clues, option cards, reveal, how to play
    game/                     # Higher or lower
    leads/LeadForm.tsx
    layout/                   # shared top bar, page title, game switcher
  lib/
    case/cases.ts             # daily case, clues, options, feedback, share text
    signals.ts                # dashboard ranking, draft opener, LinkedIn post
    leads.ts                  # lead storage
    velho.ts                  # Velho's service areas and link
  data/                       # generated by the pipeline, don't edit by hand
    hiring.json               #   companies with open ads (Who's hiring?)
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
| `DASHBOARD_KEY` | `/velho` | If set, the dashboard needs `/velho?key=<value>`. Set it for any public deploy. |
| `LOGO_DEV_TOKEN`, `UNSPLASH_ACCESS_KEY` | `fetch_logos.py`, `fetch_images.py` | Optional, for downloading logos and photos |

## Deploying to Vercel

1. **Add New → Project**, then pick this repo. Vercel detects three apps (`pipeline`,
   `velho-game-data`, `app`). Click **Import single project** on **app (Next.js)** only. The
   Python folders run offline and are not deployed.
2. Leave Root Directory as `./`, Framework as **Next.js**, and the build and install
   commands at their defaults.
3. Under **Environment Variables**, add:
   - `DASHBOARD_KEY`: any secret string, so `/velho` isn't public. Open it with `/velho?key=<value>`.
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
| **Dashboard login** | `/velho` is protected by a shared key in the link, not real accounts. | Fine for a pilot. Use proper auth before wider use. |
| **Finnish ads, English game** | Quotes are in the language of the ad, the interface is in English. | A Finnish interface, since the audience is Finnish. |

## Ground rules and status

- This is a **prototype**. Nothing has been published in Velho's name and no real company has
  been contacted. The draft openers and posts are for Velho to review and decide whether to send.
- Everything Velho-facing, like the LinkedIn post and the openers, is a draft. Velho approves
  it before anything goes out.
