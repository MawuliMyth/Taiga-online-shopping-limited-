alter table public.store_settings
  add column if not exists revenue_reporting_started_at timestamptz;

create or replace function public.start_new_revenue_reporting_period()
returns timestamptz
language plpgsql
security definer
set search_path=''
as $$
declare
  started_at timestamptz:=clock_timestamp();
  previous_started_at timestamptz;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required';
  end if;

  select revenue_reporting_started_at
    into previous_started_at
    from public.store_settings
    where id=1
    for update;

  update public.store_settings
    set revenue_reporting_started_at=started_at,
        updated_at=started_at
    where id=1;

  insert into public.admin_audit_logs(actor_id,action,entity_type,entity_id,details)
  values(
    auth.uid(),
    'revenue.reporting_period_started',
    'store_settings',
    '1',
    jsonb_build_object(
      'previous_started_at',previous_started_at,
      'started_at',started_at,
      'orders_preserved',true
    )
  );

  return started_at;
end;
$$;

revoke all on function public.start_new_revenue_reporting_period() from public,anon;
grant execute on function public.start_new_revenue_reporting_period() to authenticated;
