-- Run once in the Supabase SQL Editor. Only the server secret can access these objects.
begin;

create table if not exists public.dashboard_job_ads (
  url text primary key,
  company_id text not null,
  data jsonb not null,
  fetched_at timestamptz not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists dashboard_job_ads_fetched_at on public.dashboard_job_ads (fetched_at);

create table if not exists public.dashboard_job_refresh (
  id boolean primary key default true check (id),
  next_category integer not null default 0,
  runs integer not null default 0,
  updated_at timestamptz,
  last_attempt_at timestamptz,
  last_error text,
  lease_token uuid,
  lease_until timestamptz
);
insert into public.dashboard_job_refresh (id) values (true) on conflict do nothing;

alter table public.dashboard_job_ads enable row level security;
alter table public.dashboard_job_refresh enable row level security;
revoke all on public.dashboard_job_ads, public.dashboard_job_refresh from anon, authenticated;
grant select, insert, update, delete on public.dashboard_job_ads, public.dashboard_job_refresh to service_role;

-- Claim before scraping. Crashed jobs release their lease automatically after 12 minutes.
-- Advance the category on attempts so one inaccessible category cannot stall the rotation.
create or replace function public.claim_dashboard_job_refresh()
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare state public.dashboard_job_refresh; token uuid := gen_random_uuid();
begin
  select * into state from public.dashboard_job_refresh where id = true for update;
  if state.lease_until > now() then return null; end if;
  update public.dashboard_job_refresh
    set lease_token = token, lease_until = now() + interval '12 minutes',
        last_attempt_at = now(), next_category = next_category + 1
    where id = true;
  return jsonb_build_object('token', token, 'offset', state.next_category);
end;
$$;

-- One transaction: all ads and the successful-refresh timestamp change together.
create or replace function public.finish_dashboard_job_refresh(p_token uuid, p_ads jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare ad jsonb;
begin
  perform 1 from public.dashboard_job_refresh
    where id = true and lease_token = p_token and lease_until > now() for update;
  if not found then raise exception 'Refresh lease expired or replaced'; end if;
  if jsonb_typeof(p_ads) is distinct from 'array' then raise exception 'Expected an ads array'; end if;
  if jsonb_array_length(p_ads) = 0 then raise exception 'Empty refresh refused'; end if;
  for ad in select value from jsonb_array_elements(p_ads) loop
    if coalesce(ad->>'url', '') !~ '^https://www[.]jobly[.]fi/tyopaikka/'
       or coalesce(ad->>'companyId', '') = ''
       or coalesce(ad->>'companyName', '') = ''
       or coalesce(ad->>'title', '') = ''
       or coalesce(ad->>'fetchedAt', '') = ''
    then raise exception 'Invalid Jobly ad'; end if;
    insert into public.dashboard_job_ads (url, company_id, data, fetched_at)
      values (ad->>'url', ad->>'companyId', ad, (ad->>'fetchedAt')::timestamptz)
      on conflict (url) do update set
        company_id = excluded.company_id, data = excluded.data,
        fetched_at = excluded.fetched_at, last_seen_at = now();
  end loop;
  update public.dashboard_job_refresh set runs = runs + 1, updated_at = now(),
    last_error = null, lease_token = null, lease_until = null where id = true;
end;
$$;

create or replace function public.fail_dashboard_job_refresh(p_token uuid)
returns void language sql security invoker set search_path = '' as $$
  update public.dashboard_job_refresh set
    last_error = 'Jobly refresh failed. Previous ads were kept. Check the GitHub Actions run.',
    lease_token = null, lease_until = null
    where id = true and lease_token = p_token;
$$;

-- Aggregate in the database so PostgREST's default row limit cannot truncate the sample.
-- Ads not refreshed for 30 days remain stored but no longer affect dashboard rankings.
create or replace function public.dashboard_job_snapshot()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'ads', (select coalesce(jsonb_agg(data order by url), '[]'::jsonb)
      from public.dashboard_job_ads where fetched_at >= now() - interval '30 days'),
    'updatedAt', coalesce(updated_at::text, ''), 'runs', runs,
    'lastError', last_error
  ) from public.dashboard_job_refresh where id = true;
$$;

revoke execute on function public.claim_dashboard_job_refresh(),
  public.finish_dashboard_job_refresh(uuid, jsonb), public.fail_dashboard_job_refresh(uuid),
  public.dashboard_job_snapshot() from public, anon, authenticated;
grant execute on function public.claim_dashboard_job_refresh(),
  public.finish_dashboard_job_refresh(uuid, jsonb), public.fail_dashboard_job_refresh(uuid),
  public.dashboard_job_snapshot() to service_role;

commit;
