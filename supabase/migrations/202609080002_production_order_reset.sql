begin;
create or replace function public.reset_production_orders(confirmation text,expected_ids uuid[],maintenance_owner uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actual_ids uuid[]; requested_ids uuid[]; actor uuid; deleted_items bigint; deleted_orders bigint; reset_at timestamptz:=clock_timestamp();
begin
  if auth.role()='service_role' then
    if not exists(select 1 from public.profiles where id=maintenance_owner and role='owner') then raise exception 'Owner required'; end if;
    actor:=maintenance_owner;
  else
    if not public.is_owner() then raise exception 'Owner with MFA required'; end if;
    actor:=auth.uid();
  end if;
  if confirmation is distinct from 'DELETE ALL ORDERS' then raise exception 'Confirmation does not match'; end if;
  lock table public.orders in exclusive mode;
  select coalesce(array_agg(id order by id),'{}'::uuid[]) into actual_ids from public.orders;
  select coalesce(array_agg(id order by id),'{}'::uuid[]) into requested_ids from unnest(expected_ids) as t(id);
  if actual_ids is distinct from requested_ids then raise exception 'Orders changed. Refresh and review before resetting.'; end if;
  select count(*) into deleted_items from public.order_items;
  -- Keep verified references to prevent reuse of an old payment after reset.
  update public.payment_transactions set order_id=null where order_id=any(actual_ids);
  delete from public.orders where id=any(actual_ids);
  get diagnostics deleted_orders=row_count;
  update public.store_settings set revenue_reporting_started_at=reset_at,updated_at=reset_at where id=1;
  insert into public.admin_audit_logs(actor_id,action,entity_type,entity_id,details)
  values(actor,'orders.production_reset','orders',null,jsonb_build_object('orders_deleted',deleted_orders,'items_deleted',deleted_items,'reset_at',reset_at,'payment_references_preserved',true,'maintenance',auth.role()='service_role'));
  return jsonb_build_object('orders_deleted',deleted_orders,'items_deleted',deleted_items,'reset_at',reset_at);
end; $$;
revoke all on function public.reset_production_orders(text,uuid[],uuid) from public,anon;
grant execute on function public.reset_production_orders(text,uuid[],uuid) to authenticated,service_role;
commit;
