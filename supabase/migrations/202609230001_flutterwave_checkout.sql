-- Run this entire file once in the Taiga Supabase SQL Editor.
-- Additive only: existing orders, products, customers and payment records are preserved.
begin;

-- Provider webhooks have no signed-in administrator; null means a system event.
alter table public.admin_audit_logs alter column actor_id drop not null;

create table public.flutterwave_checkouts (
  reference text primary key default ('taiga-live-' || gen_random_uuid()::text),
  user_id uuid not null references auth.users(id),
  request_id uuid not null,
  customer_email text not null,
  items jsonb not null check (jsonb_array_length(items) > 0),
  address jsonb not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null default 'NGN' check (currency = 'NGN'),
  status text not null default 'pending' check (status in ('pending','paid','review')),
  checkout_url text,
  transaction_id text unique,
  order_id uuid references public.orders(id) on delete set null,
  review_reason text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  verified_at timestamptz,
  unique (user_id, request_id)
);
create index flutterwave_checkouts_user on public.flutterwave_checkouts(user_id, created_at desc);
alter table public.flutterwave_checkouts enable row level security;
revoke all on public.flutterwave_checkouts from anon, authenticated;
grant all on public.flutterwave_checkouts to service_role;
grant select on public.flutterwave_checkouts to authenticated;
create policy "MFA administrators read checkout payments" on public.flutterwave_checkouts
for select to authenticated using (public.is_admin());

-- Every verified provider transaction is retained, including mismatches and duplicate charges.
create table public.flutterwave_receipts (
  transaction_id text primary key,
  reference text not null references public.flutterwave_checkouts(reference),
  amount_minor bigint not null,
  currency text not null,
  customer_email text not null,
  outcome text not null check (outcome in ('paid','review')),
  reason text,
  verified_at timestamptz not null default now()
);
alter table public.flutterwave_receipts enable row level security;
revoke all on public.flutterwave_receipts from anon, authenticated;
grant all on public.flutterwave_receipts to service_role;
grant select on public.flutterwave_receipts to authenticated;
create policy "MFA administrators read payment receipts" on public.flutterwave_receipts
for select to authenticated using (public.is_admin());

create function public.create_flutterwave_checkout(target_user uuid, checkout_request uuid, delivery_address jsonb, expected_minor bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare saved public.flutterwave_checkouts; line record; variant jsonb; snapshot jsonb := '[]'::jsonb;
  price numeric; stock integer; amount bigint := 0; email text;
begin
  perform pg_advisory_xact_lock(hashtextextended('flw-user-' || target_user::text,0));
  select * into saved from public.flutterwave_checkouts where user_id=target_user and request_id=checkout_request;
  if found then
    if saved.address is distinct from delivery_address or saved.amount_minor is distinct from expected_minor then
      raise exception 'Checkout changed. Return to your cart and try again.';
    end if;
    return to_jsonb(saved) || jsonb_build_object('created',false);
  end if;
  if (select count(*) from public.flutterwave_checkouts where user_id=target_user and created_at>now()-interval '1 hour')>=20 then
    raise exception 'Too many payment attempts. Please wait before trying again.';
  end if;
  select lower(u.email) into email from auth.users u where u.id=target_user;
  if email is null then raise exception 'A customer email is required'; end if;
  if delivery_address->>'delivery_method' is distinct from 'standard' or
     delivery_address->>'delivery_payment' is distinct from 'courier_separately' then
    raise exception 'Invalid delivery method';
  end if;
  -- Consistent lock order also used by finalization. Catalogue values, not browser prices.
  perform 1 from public.products p join public.cart_items c on c.product_id=p.id
    where c.user_id=target_user order by p.id for share of p;
  for line in select c.*, p.name, p.price, p.inventory, p.variants, p.is_active, p.image_url
    from public.cart_items c join public.products p on p.id=c.product_id
    where c.user_id=target_user order by c.product_id,c.variant_key for share of c
  loop
    variant:=null;
    if line.variant_key='default' then
      if jsonb_array_length(line.variants)>0 then raise exception 'Choose a variant for %',line.name; end if;
      price:=line.price; stock:=line.inventory;
    else
      select v into variant from jsonb_array_elements(line.variants) v where v->>'id'=line.variant_key limit 1;
      if variant is null or variant->>'active'='false' then raise exception 'A selected variant is no longer available'; end if;
      price:=coalesce((variant->>'price')::numeric,line.price); stock:=coalesce((variant->>'inventory')::integer,0);
    end if;
    if not line.is_active or price<=0 or price<>round(price,2) or stock<line.quantity or line.quantity not between 1 and 99 then
      raise exception 'An item is unavailable or has insufficient stock. Review your cart.';
    end if;
    amount:=amount + (price*100)::bigint * line.quantity;
    snapshot:=snapshot || jsonb_build_array(jsonb_build_object(
      'product_id',line.product_id,'product_name',line.name,'variant_key',line.variant_key,
      'selected_variant',variant,'unit_price',price,'quantity',line.quantity,
      'image_url',coalesce(variant->>'image_url',line.image_url),
      'cart_updated_at',line.updated_at,'cart_created_at',line.created_at));
  end loop;
  if amount<=0 then raise exception 'Your cart is empty'; end if;
  if amount>999999999999 then raise exception 'This order exceeds the online checkout limit. Contact support.'; end if;
  if amount<>expected_minor then raise exception 'Prices have changed. Refresh your cart before paying.'; end if;
  insert into public.flutterwave_checkouts(user_id,request_id,customer_email,items,address,amount_minor)
  values(target_user,checkout_request,email,snapshot,delivery_address,amount) returning * into saved;
  return to_jsonb(saved) || jsonb_build_object('created',true);
end; $$;
revoke all on function public.create_flutterwave_checkout(uuid,uuid,jsonb,bigint) from public,anon,authenticated;
grant execute on function public.create_flutterwave_checkout(uuid,uuid,jsonb,bigint) to service_role;

create function public.finalize_flutterwave_checkout(payment_ref text, provider_transaction text, verified_minor bigint, verified_currency text, verified_email text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare saved public.flutterwave_checkouts; receipt public.flutterwave_receipts; placed public.orders;
  item jsonb; product public.products; variant jsonb; variants_new jsonb; reason text;
begin
  -- The server calls this ONLY after a successful authenticated Flutterwave API verification.
  perform pg_advisory_xact_lock(hashtextextended('flw-tx-' || provider_transaction,0));
  select * into saved from public.flutterwave_checkouts where reference=payment_ref for update;
  if not found then raise exception 'Checkout not found'; end if;
  select * into receipt from public.flutterwave_receipts where transaction_id=provider_transaction;
  if found then
    if receipt.reference<>payment_ref then raise exception 'Transaction already belongs to another checkout'; end if;
    select * into placed from public.orders where id=saved.order_id;
    return jsonb_build_object('status',receipt.outcome,'order_number',placed.order_number,'reference',payment_ref);
  end if;
  if saved.transaction_id is not null then reason:='Additional payment for an already processed checkout. Review for refund.';
  elsif verified_currency<>saved.currency or verified_minor<>saved.amount_minor or lower(verified_email)<>saved.customer_email then
    reason:='Verified payment details differ from checkout. Review amount, currency and payer before refunding.';
  end if;
  if reason is null then
    perform 1 from public.products p where p.id in (select (v->>'product_id')::uuid from jsonb_array_elements(saved.items) v) order by p.id for update;
    for item in select v from jsonb_array_elements(saved.items) v loop
      select * into product from public.products where id=(item->>'product_id')::uuid;
      if not found or not product.is_active then reason:='A purchased product is no longer available. Contact customer to arrange a refund.'; exit; end if;
      if item->>'variant_key'='default' then
        if jsonb_array_length(product.variants)>0 or product.inventory<(item->>'quantity')::integer then
          reason:='Stock changed after payment started. Contact customer to arrange fulfilment or refund.'; exit;
        end if;
      else
        select v into variant from jsonb_array_elements(product.variants) v where v->>'id'=item->>'variant_key' limit 1;
        if variant is null or variant->>'active'='false' or coalesce((variant->>'inventory')::integer,0)<(item->>'quantity')::integer then
          reason:='Variant stock changed after payment started. Contact customer to arrange fulfilment or refund.'; exit;
        end if;
      end if;
    end loop;
  end if;
  if reason is not null then
    insert into public.flutterwave_receipts(transaction_id,reference,amount_minor,currency,customer_email,outcome,reason)
      values(provider_transaction,payment_ref,verified_minor,verified_currency,verified_email,'review',reason);
    if saved.transaction_id is null then
      update public.flutterwave_checkouts set status='review',transaction_id=provider_transaction,review_reason=reason,verified_at=now() where reference=payment_ref;
    end if;
    insert into public.admin_audit_logs(actor_id,action,entity_type,entity_id,details)
      values(null,'payment.review_required','flutterwave',payment_ref,jsonb_build_object('transaction_id',provider_transaction,'reason',reason));
    return jsonb_build_object('status','review','reference',payment_ref);
  end if;
  insert into public.orders(user_id,status,subtotal,shipping,total,shipping_address,payment_reference,paid_at)
    values(saved.user_id,'processing',saved.amount_minor/100.0,0,saved.amount_minor/100.0,saved.address,payment_ref,now()) returning * into placed;
  for item in select v from jsonb_array_elements(saved.items) v loop
    if item->>'variant_key'='default' then
      update public.products set inventory=inventory-(item->>'quantity')::integer,updated_at=now() where id=(item->>'product_id')::uuid;
    else
      select jsonb_agg(case when v->>'id'=item->>'variant_key'
        then jsonb_set(v,'{inventory}',to_jsonb((v->>'inventory')::integer-(item->>'quantity')::integer)) else v end order by pos)
      into variants_new from public.products p, jsonb_array_elements(p.variants) with ordinality as variant_rows(v,pos)
      where p.id=(item->>'product_id')::uuid;
      update public.products set variants=variants_new,
        inventory=(select coalesce(sum((v->>'inventory')::integer),0) from jsonb_array_elements(variants_new) v),updated_at=now()
        where id=(item->>'product_id')::uuid;
    end if;
    insert into public.order_items(order_id,product_id,product_name,unit_price,quantity,selected_variant)
      values(placed.id,(item->>'product_id')::uuid,item->>'product_name',(item->>'unit_price')::numeric,(item->>'quantity')::integer,nullif(item->'selected_variant','null'::jsonb));
    -- Do not clear new or edited items added while the customer was at Flutterwave.
    delete from public.cart_items where user_id=saved.user_id and product_id=(item->>'product_id')::uuid
      and variant_key=item->>'variant_key' and quantity=(item->>'quantity')::integer
      and updated_at=(item->>'cart_updated_at')::timestamptz and created_at=(item->>'cart_created_at')::timestamptz;
  end loop;
  insert into public.payment_transactions(reference,user_id,order_id,amount_minor,currency,status,provider)
    values(payment_ref,saved.user_id,placed.id,verified_minor,verified_currency,'success','flutterwave');
  insert into public.flutterwave_receipts(transaction_id,reference,amount_minor,currency,customer_email,outcome)
    values(provider_transaction,payment_ref,verified_minor,verified_currency,verified_email,'paid');
  update public.flutterwave_checkouts set status='paid',transaction_id=provider_transaction,order_id=placed.id,verified_at=now() where reference=payment_ref;
  insert into public.admin_audit_logs(actor_id,action,entity_type,entity_id,details)
    values(null,'payment.verified','order',placed.id::text,jsonb_build_object('provider','flutterwave','reference',payment_ref));
  return jsonb_build_object('status','paid','order_number',placed.order_number,'reference',payment_ref);
end; $$;
revoke all on function public.finalize_flutterwave_checkout(text,text,bigint,text,text) from public,anon,authenticated;
grant execute on function public.finalize_flutterwave_checkout(text,text,bigint,text,text) to service_role;
notify pgrst, 'reload schema';
commit;
