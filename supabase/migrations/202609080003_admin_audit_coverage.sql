begin;
-- Record administrative catalogue changes in the same transaction as the change.
create or replace function public.audit_admin_catalogue_change()
returns trigger language plpgsql security definer set search_path='' as $$
declare before_row jsonb; after_row jsonb; changed_fields jsonb;
begin
  if not public.is_admin() then return null; end if;
  before_row := case when TG_OP <> 'INSERT' then to_jsonb(OLD) else '{}'::jsonb end;
  after_row := case when TG_OP <> 'DELETE' then to_jsonb(NEW) else '{}'::jsonb end;
  if TG_OP='UPDATE' and before_row=after_row then return null; end if;
  select coalesce(jsonb_agg(key order by key),'[]'::jsonb) into changed_fields
  from (select key from jsonb_object_keys(before_row || after_row) as fields(key)
        where before_row->key is distinct from after_row->key) changes;
  insert into public.admin_audit_logs(actor_id,action,entity_type,entity_id,details)
  values(auth.uid(),TG_TABLE_NAME || '.' || lower(TG_OP),TG_TABLE_NAME,
    coalesce(after_row->>'id',before_row->>'id'),
    jsonb_build_object('changed_fields',changed_fields));
  return null;
end; $$;
revoke all on function public.audit_admin_catalogue_change() from public,anon,authenticated;
do $$ declare target text; begin
  foreach target in array array['products','categories','store_settings','banners','product_images','delivery_rates'] loop
    execute format('drop trigger if exists audit_admin_change on public.%I',target);
    execute format('create trigger audit_admin_change after insert or update or delete on public.%I for each row execute function public.audit_admin_catalogue_change()',target);
  end loop;
end; $$;
grant select on public.admin_audit_logs to authenticated;
commit;
