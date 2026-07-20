-- Product variants with combination-level pricing and atomic inventory.
alter table public.products add column if not exists variants jsonb not null default '[]'::jsonb;
alter table public.cart_items add column if not exists variant_key text not null default 'default';
alter table public.cart_items add column if not exists selected_variant jsonb;
alter table public.order_items add column if not exists selected_variant jsonb;

alter table public.cart_items drop constraint if exists cart_items_pkey;
alter table public.cart_items add primary key (user_id, product_id, variant_key);

create or replace function public.checkout_quote_for_user(target_user uuid, delivery_method text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare subtotal numeric(12,2); shipping numeric(12,2); settings public.store_settings;
begin
  if delivery_method not in ('standard','pickup') then raise exception 'Select a valid delivery method'; end if;
  select * into settings from public.store_settings where id=1;
  if exists(
    select 1 from public.cart_items c join public.products p on p.id=c.product_id
    left join lateral (select item from jsonb_array_elements(p.variants) item where item->>'id'=c.variant_key limit 1) v on true
    where c.user_id=target_user and (not p.is_active or c.quantity<1 or c.quantity>case when c.variant_key='default' then p.inventory else coalesce((v.item->>'inventory')::integer,0) end)
  ) then raise exception 'A selected product variant is unavailable or out of stock'; end if;
  select coalesce(sum(coalesce((v.item->>'price')::numeric,p.price)*c.quantity),0) into subtotal
  from public.cart_items c join public.products p on p.id=c.product_id
  left join lateral (select item from jsonb_array_elements(p.variants) item where item->>'id'=c.variant_key limit 1) v on true
  where c.user_id=target_user and p.is_active
    and c.quantity between 1 and case when c.variant_key='default' then p.inventory else coalesce((v.item->>'inventory')::integer,0) end;
  if subtotal<=0 then raise exception 'Your cart is empty or a selected variant is out of stock'; end if;
  shipping:=case when delivery_method='pickup' then settings.pickup_shipping_fee when subtotal>=settings.free_shipping_threshold then 0 else settings.standard_shipping_fee end;
  return jsonb_build_object('subtotal',subtotal,'shipping',shipping,'total',subtotal+shipping,'amount_minor',round((subtotal+shipping)*100));
end; $$;
revoke all on function public.checkout_quote_for_user(uuid,text) from public,anon,authenticated;
grant execute on function public.checkout_quote_for_user(uuid,text) to service_role;

create or replace function public.finalize_paid_checkout(target_user uuid,address jsonb,payment_ref text,paid_amount_minor bigint,paid_currency text)
returns public.orders language plpgsql security definer set search_path='' as $$
declare new_order public.orders; quote jsonb; item record; delivery_method text:=address->>'delivery_method'; updated_variants jsonb; unit_price numeric;
begin
  if paid_currency<>'NGN' then raise exception 'Unsupported payment currency'; end if;
  if exists(select 1 from public.payment_transactions where reference=payment_ref) then raise exception 'Payment reference has already been used'; end if;
  perform 1 from public.products p join public.cart_items c on c.product_id=p.id where c.user_id=target_user order by p.id for update of p;
  quote:=public.checkout_quote_for_user(target_user,delivery_method);
  if (quote->>'amount_minor')::bigint<>paid_amount_minor then raise exception 'Payment amount does not match the current cart'; end if;
  insert into public.orders(user_id,status,subtotal,shipping,total,shipping_address,payment_reference,paid_at)
  values(target_user,'processing',(quote->>'subtotal')::numeric,(quote->>'shipping')::numeric,(quote->>'total')::numeric,address,payment_ref,now()) returning * into new_order;
  for item in select c.product_id,c.quantity,c.variant_key,c.selected_variant,p.name,p.price,p.variants from public.cart_items c join public.products p on p.id=c.product_id where c.user_id=target_user loop
    if item.variant_key='default' then
      update public.products set inventory=inventory-item.quantity,updated_at=now() where id=item.product_id and is_active and inventory>=item.quantity;
      unit_price:=item.price;
    else
      select jsonb_agg(case when value->>'id'=item.variant_key then jsonb_set(value,'{inventory}',to_jsonb((value->>'inventory')::integer-item.quantity)) else value end order by ordinality),
             coalesce(max(case when value->>'id'=item.variant_key then (value->>'price')::numeric end),item.price)
      into updated_variants,unit_price from jsonb_array_elements(item.variants) with ordinality
      where not (value->>'id'=item.variant_key and (value->>'inventory')::integer<item.quantity);
      if updated_variants is null or not exists(select 1 from jsonb_array_elements(item.variants) v where v->>'id'=item.variant_key and (v->>'inventory')::integer>=item.quantity) then raise exception 'Insufficient stock for selected % variant',item.name; end if;
      update public.products set variants=updated_variants,inventory=(select coalesce(sum((v->>'inventory')::integer),0) from jsonb_array_elements(updated_variants) v),updated_at=now() where id=item.product_id and is_active;
    end if;
    if not found then raise exception 'Insufficient stock for %',item.name; end if;
    insert into public.order_items(order_id,product_id,product_name,unit_price,quantity,selected_variant) values(new_order.id,item.product_id,item.name,unit_price,item.quantity,item.selected_variant);
  end loop;
  insert into public.payment_transactions(reference,user_id,order_id,amount_minor,currency,status) values(payment_ref,target_user,new_order.id,paid_amount_minor,paid_currency,'success');
  delete from public.cart_items where user_id=target_user;
  return new_order;
end; $$;
revoke all on function public.finalize_paid_checkout(uuid,jsonb,text,bigint,text) from public,anon,authenticated;
grant execute on function public.finalize_paid_checkout(uuid,jsonb,text,bigint,text) to service_role;

create or replace function public.save_product_with_gallery(product_key uuid,payload jsonb,gallery jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare saved_id uuid;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if product_key is null then
    insert into public.products(category_id,name,slug,description,price,compare_at_price,image_url,badge,rating,inventory,is_active,variants)
    values(nullif(payload->>'category_id','')::uuid,payload->>'name',payload->>'slug',payload->>'description',(payload->>'price')::numeric,nullif(payload->>'compare_at_price','')::numeric,payload->>'image_url',payload->>'badge',(payload->>'rating')::numeric,(payload->>'inventory')::integer,(payload->>'is_active')::boolean,coalesce(payload->'variants','[]'::jsonb)) returning id into saved_id;
  else
    update public.products set category_id=nullif(payload->>'category_id','')::uuid,name=payload->>'name',slug=payload->>'slug',description=payload->>'description',price=(payload->>'price')::numeric,compare_at_price=nullif(payload->>'compare_at_price','')::numeric,image_url=payload->>'image_url',badge=payload->>'badge',rating=(payload->>'rating')::numeric,inventory=(payload->>'inventory')::integer,is_active=(payload->>'is_active')::boolean,variants=coalesce(payload->'variants','[]'::jsonb),updated_at=now() where id=product_key returning id into saved_id;
  end if;
  if saved_id is null then raise exception 'Product was not found'; end if;
  delete from public.product_images where product_id=saved_id;
  insert into public.product_images(product_id,image_url,alt_text,sort_order) select saved_id,value#>>'{}',payload->>'name',ordinality-1 from jsonb_array_elements(gallery) with ordinality;
  return saved_id;
end; $$;
grant execute on function public.save_product_with_gallery(uuid,jsonb,jsonb) to authenticated;
