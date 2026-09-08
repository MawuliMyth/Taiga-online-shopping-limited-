begin;
create table if not exists public.site_visit_events (
  id uuid primary key,
  visitor_id uuid not null,
  session_id uuid not null,
  path text not null check(length(path)<=240),
  source text not null check(length(source)<=120),
  device text not null check(device in ('mobile','tablet','desktop')),
  created_at timestamptz not null default now()
);
create index if not exists site_visit_events_date on public.site_visit_events(created_at);
alter table public.site_visit_events enable row level security;
revoke all on public.site_visit_events from anon,authenticated;
grant all on public.site_visit_events to service_role;
create or replace function public.visitor_analytics_summary(days integer default 30)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; since_at timestamptz;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  since_at := now() - make_interval(days=>least(90,greatest(1,days)));
  select jsonb_build_object(
    'visitors',count(distinct visitor_id),'visits',count(distinct session_id),'pageViews',count(*),
    'today',count(distinct visitor_id) filter(where created_at >= date_trunc('day',now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos'),
    'daily',(select coalesce(jsonb_agg(row_to_json(d)),'[]'::jsonb) from (select (created_at at time zone 'Africa/Lagos')::date as day,count(distinct visitor_id) as visitors,count(*) as views from public.site_visit_events where created_at>=since_at group by 1 order by 1) d),
    'pages',(select coalesce(jsonb_agg(row_to_json(p)),'[]'::jsonb) from (select path,count(*) as views from public.site_visit_events where created_at>=since_at group by path order by count(*) desc limit 10) p),
    'sources',(select coalesce(jsonb_agg(row_to_json(s)),'[]'::jsonb) from (select source,count(distinct session_id) as visits from public.site_visit_events where created_at>=since_at group by source order by count(distinct session_id) desc limit 10) s),
    'devices',(select coalesce(jsonb_agg(row_to_json(d)),'[]'::jsonb) from (select device,count(distinct session_id) as visits from public.site_visit_events where created_at>=since_at group by device order by count(distinct session_id) desc) d)
  ) into result from public.site_visit_events where created_at>=since_at;
  return result;
end; $$;
revoke all on function public.visitor_analytics_summary(integer) from public,anon;
grant execute on function public.visitor_analytics_summary(integer) to authenticated;
commit;
