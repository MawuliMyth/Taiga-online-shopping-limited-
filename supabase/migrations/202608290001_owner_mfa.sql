-- One protected owner account and mandatory MFA for every administrator.
drop function if exists public.set_administrator(uuid,boolean);

create type public.user_role_v2 as enum ('customer','admin','owner');
alter table public.profiles alter column role drop default;
alter table public.profiles alter column role type public.user_role_v2 using role::text::public.user_role_v2;
drop type public.user_role;
alter type public.user_role_v2 rename to user_role;
alter table public.profiles alter column role set default 'customer'::public.user_role;

update public.profiles p
set email=u.email
from auth.users u
where p.id=u.id and (p.email is null or lower(p.email)<>lower(u.email));

update public.profiles
set role='owner'::public.user_role
where lower(email)='josephmawulemensah04@gmail.com';

create or replace function public.has_admin_role() returns boolean
language sql stable security definer set search_path=''
as $$
  select exists(
    select 1 from public.profiles
    where id=auth.uid() and role in ('admin'::public.user_role,'owner'::public.user_role)
  );
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path=''
as $$
  select public.has_admin_role() and coalesce(auth.jwt()->>'aal','aal1')='aal2';
$$;

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path=''
as $$
  select exists(
    select 1 from public.profiles
    where id=auth.uid() and role='owner'::public.user_role
  ) and coalesce(auth.jwt()->>'aal','aal1')='aal2';
$$;

create or replace function public.set_administrator(target_user uuid,make_admin boolean) returns void
language plpgsql security definer set search_path=''
as $$
declare
  old_role public.user_role;
  new_role public.user_role:=case when make_admin then 'admin'::public.user_role else 'customer'::public.user_role end;
begin
  if not public.is_owner() then raise exception 'Only the super admin can change administrator access'; end if;
  select role into old_role from public.profiles where id=target_user for update;
  if old_role is null then raise exception 'Account not found'; end if;
  if old_role='owner'::public.user_role then raise exception 'The super admin account is protected'; end if;
  update public.profiles set role=new_role where id=target_user;
  insert into public.admin_audit_logs(actor_id,action,entity_type,entity_id,details)
  values(auth.uid(),case when make_admin then 'admin.promoted' else 'admin.demoted' end,'profile',target_user::text,jsonb_build_object('previous_role',old_role,'new_role',new_role));
end;
$$;

revoke all on function public.set_administrator(uuid,boolean) from public,anon;
grant execute on function public.set_administrator(uuid,boolean) to authenticated;
