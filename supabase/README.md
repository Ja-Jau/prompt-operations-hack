# Dashboard Jobly storage and hourly refresh

GitHub Actions runs the Python scraper every hour at minute 17 (UTC), independently
of the website. Each attempt rotates to one of twelve Jobly categories and reads up
to ten ads. Successful batches are saved directly to Supabase; `/velho` reads them
on each page request. Opening the dashboard does not start a scrape.

## One-time setup

1. In your Supabase project, open **SQL Editor → New query**. Paste the entire
   [migration](migrations/202610250001_dashboard_job_ads.sql) and click **Run**.
2. Find the project URL in **Connect**, and a server secret (`sb_secret_…`) in
   **Settings → API Keys**. The legacy `service_role` key is also supported.
3. In **Vercel → your project → Settings → Environment Variables**, add:

   ```text
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SECRET_KEY=your-server-secret
   ```

   Select the deployment environments that should read this database, then redeploy.
   For local development, use the same names in the root `.env.local` file.
   Never add `NEXT_PUBLIC_` to the secret variable.
4. In **GitHub → repository → Settings → Secrets and variables → Actions**,
   create repository secrets named `SUPABASE_URL` and `SUPABASE_SECRET_KEY` with
   those same values. These are separate from Vercel's environment variables.
5. Ensure the workflow is on `main`. Open **Actions → Refresh dashboard Jobly ads →
   Run workflow** for the first batch. Afterwards the schedule runs without visitors.
6. Check that the workflow succeeds, then open `/velho`. Its update timestamp and
   company list should reflect the saved batch. Supabase's Table Editor will show
   rows in `dashboard_job_ads` and status in `dashboard_job_refresh`.

You do not need Supabase Auth, an anon/publishable key, a database password, or a
Python runtime on Vercel for this feature. The app's existing dashboard login remains.
Both tables have Row Level Security enabled and grant no access to browser roles.
Only the server secret can read ads or invoke the refresh functions.

## Behavior and limits

- Ads are keyed by source URL. Repeat fetches update the existing row and preserve
  its first-seen timestamp. Source timestamps and short verbatim task quotes are stored.
- A database lease prevents concurrent runs, including workers on different machines.
  A crashed worker's lease expires after twelve minutes. Category rotation advances
  on attempts, so a blocked category does not prevent other categories being tried.
- Ads and successful-refresh status are committed in one transaction. Empty batches
  or failed fetches preserve the previous data, record an error, and fail the workflow.
  The dashboard shows when the last attempt failed.
- Only ads fetched within 30 days affect rankings. Older rows remain stored for
  reference. This is a recent sample, not a verified census of currently open jobs;
  the scraper does not check every saved ad for closure on every run.
- Supabase mode uses only saved ad samples for rankings. Until the first successful
  run, the dashboard has no sampled companies. Bundled game data stays unchanged.
- Without either Supabase variable, local demos retain file storage and the manual
  **Fetch job ads** button. Partial Supabase configuration raises an error rather
  than silently writing a local file.
- GitHub scheduled jobs can be delayed; they run from the default branch. Public
  repositories' scheduled workflows may be disabled after 60 days without repository
  activity. Check Actions if updates stop. Changing Vercel variables requires redeployment;
  changing GitHub secrets takes effect on the next workflow run.

For a manual worker run outside GitHub, export the two variables in your shell and
run `python pipeline/sync_dashboard_jobs.py` after installing
`velho-game-data/requirements.txt`. Python does not automatically read `.env.local`.

References: [Supabase server keys](https://supabase.com/docs/guides/getting-started/api-keys),
[GitHub schedule behavior](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).
