-- Admin-managed product specifications, warranty/returns and live merchandising.
alter table public.products add column if not exists specifications jsonb not null default '{}'::jsonb;
alter table public.products add column if not exists warranty_value integer not null default 0 check (warranty_value between 0 and 120);
alter table public.products add column if not exists warranty_unit text not null default 'months' check (warranty_unit in ('days','months','years'));
alter table public.products add column if not exists warranty_notes text;
alter table public.products add column if not exists returnable boolean not null default true;
alter table public.products add column if not exists sales_count integer not null default 0 check (sales_count >= 0);

update public.products p set sales_count=coalesce((select sum(oi.quantity)::integer from public.order_items oi join public.orders o on o.id=oi.order_id where oi.product_id=p.id and o.paid_at is not null and o.status<>'cancelled'),0);

create or replace function public.increment_product_sales() returns trigger language plpgsql security definer set search_path='' as $$
begin
  update public.products set sales_count=sales_count+new.quantity where id=new.product_id;
  return new;
end; $$;
drop trigger if exists increment_product_sales_after_order on public.order_items;
create trigger increment_product_sales_after_order after insert on public.order_items for each row execute function public.increment_product_sales();

create or replace function public.save_product_with_gallery(product_key uuid,payload jsonb,gallery jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare saved_id uuid;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if product_key is null then
    insert into public.products(category_id,name,slug,description,price,compare_at_price,image_url,badge,rating,inventory,is_active,variants,specifications,warranty_value,warranty_unit,warranty_notes,returnable)
    values(nullif(payload->>'category_id','')::uuid,payload->>'name',payload->>'slug',payload->>'description',(payload->>'price')::numeric,nullif(payload->>'compare_at_price','')::numeric,payload->>'image_url',payload->>'badge',0,(payload->>'inventory')::integer,(payload->>'is_active')::boolean,coalesce(payload->'variants','[]'::jsonb),coalesce(payload->'specifications','{}'::jsonb),coalesce((payload->>'warranty_value')::integer,0),coalesce(payload->>'warranty_unit','months'),nullif(payload->>'warranty_notes',''),coalesce((payload->>'returnable')::boolean,true)) returning id into saved_id;
  else
    update public.products set category_id=nullif(payload->>'category_id','')::uuid,name=payload->>'name',slug=payload->>'slug',description=payload->>'description',price=(payload->>'price')::numeric,compare_at_price=nullif(payload->>'compare_at_price','')::numeric,image_url=payload->>'image_url',badge=payload->>'badge',inventory=(payload->>'inventory')::integer,is_active=(payload->>'is_active')::boolean,variants=coalesce(payload->'variants','[]'::jsonb),specifications=coalesce(payload->'specifications','{}'::jsonb),warranty_value=coalesce((payload->>'warranty_value')::integer,0),warranty_unit=coalesce(payload->>'warranty_unit','months'),warranty_notes=nullif(payload->>'warranty_notes',''),returnable=coalesce((payload->>'returnable')::boolean,true),updated_at=now() where id=product_key returning id into saved_id;
  end if;
  if saved_id is null then raise exception 'Product was not found'; end if;
  delete from public.product_images where product_id=saved_id;
  insert into public.product_images(product_id,image_url,alt_text,sort_order) select saved_id,value#>>'{}',payload->>'name',ordinality-1 from jsonb_array_elements(gallery) with ordinality;
  return saved_id;
end; $$;
grant execute on function public.save_product_with_gallery(uuid,jsonb,jsonb) to authenticated;
