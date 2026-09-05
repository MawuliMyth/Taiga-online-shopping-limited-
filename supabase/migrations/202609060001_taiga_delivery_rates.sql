-- No example prices are seeded. Empty/disabled destinations require a manual quote.
create table public.delivery_rates (
  id uuid primary key default gen_random_uuid(),
  state text not null check (length(trim(state)) between 2 and 80),
  city text not null default '*' check (length(trim(city)) between 1 and 80),
  enabled boolean not null default false,
  base_fee numeric(12,2) check (base_fee >= 0),
  included_kg numeric(10,3) check (included_kg > 0),
  extra_per_kg numeric(12,2) check (extra_per_kg >= 0),
  max_kg numeric(10,3) check (max_kg > 0),
  min_days integer check (min_days >= 0),
  max_days integer check (max_days >= 0),
  surcharge numeric(12,2) check (surcharge >= 0),
  round_up boolean not null default true,
  updated_at timestamptz not null default now(),
  check (not enabled or (base_fee is not null and included_kg is not null and extra_per_kg is not null and max_kg is not null and max_kg >= included_kg and min_days is not null and max_days is not null and max_days >= min_days and surcharge is not null))
);
create unique index delivery_rates_destination on public.delivery_rates (lower(trim(state)), lower(trim(city)));
alter table public.delivery_rates enable row level security;
grant select, insert, update, delete on public.delivery_rates to authenticated;
grant all on public.delivery_rates to service_role;
create policy "Administrators manage delivery rates" on public.delivery_rates for all to authenticated using(public.is_admin()) with check(public.is_admin());
