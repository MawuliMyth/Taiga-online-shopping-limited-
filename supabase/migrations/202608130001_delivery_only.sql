update public.store_settings
set standard_shipping_fee=2500
where id=1;

create or replace function public.checkout_quote_for_user(target_user uuid, delivery_method text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare subtotal numeric:=0; shipping numeric:=0; item record; settings public.store_settings%rowtype; unit_price numeric; selected jsonb;
begin
  if delivery_method<>'standard' then raise exception 'Only standard delivery is available'; end if;
  select * into settings from public.store_settings where id=1;
  for item in
    select c.product_id,c.variant_key,c.quantity,c.selected_variant,p.price,p.inventory,p.is_active,p.variants
    from public.cart_items c join public.products p on p.id=c.product_id
    where c.user_id=target_user for update of p
  loop
    if not item.is_active then raise exception 'A cart product is unavailable'; end if;
    if item.variant_key<>'default' then
      select value into selected from jsonb_array_elements(coalesce(item.variants,'[]'::jsonb)) value where value->>'id'=item.variant_key;
      if selected is null or coalesce((selected->>'inventory')::integer,0)<item.quantity then raise exception 'A selected product variant is unavailable or out of stock'; end if;
      unit_price:=coalesce((selected->>'price')::numeric,item.price);
    else
      if item.inventory<item.quantity then raise exception 'Insufficient stock for a cart product'; end if;
      unit_price:=item.price;
    end if;
    subtotal:=subtotal+(unit_price*item.quantity);
  end loop;
  if subtotal<=0 then raise exception 'Your cart is empty'; end if;
  shipping:=greatest(settings.standard_shipping_fee,2500);
  return jsonb_build_object('subtotal',subtotal,'shipping',shipping,'total',subtotal+shipping,'amount_minor',round((subtotal+shipping)*100));
end $$;

revoke all on function public.checkout_quote_for_user(uuid,text) from public,anon,authenticated;
grant execute on function public.checkout_quote_for_user(uuid,text) to service_role;
