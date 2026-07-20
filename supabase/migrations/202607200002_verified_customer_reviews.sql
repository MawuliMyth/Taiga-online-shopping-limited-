-- Ratings come only from authenticated customers who purchased the product.
create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reviewer_name text not null,
  rating integer not null check (rating between 1 and 5),
  title text not null check (char_length(title) between 3 and 100),
  body text not null check (char_length(body) between 10 and 1200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_id,user_id)
);

create index if not exists product_reviews_product_idx on public.product_reviews(product_id,created_at desc);
alter table public.product_reviews enable row level security;
drop policy if exists "Public read product reviews" on public.product_reviews;
create policy "Public read product reviews" on public.product_reviews for select using (true);
drop policy if exists "Verified customers create reviews" on public.product_reviews;
create policy "Verified customers create reviews" on public.product_reviews for insert to authenticated with check (
  user_id=auth.uid() and exists(
    select 1 from public.order_items oi join public.orders o on o.id=oi.order_id
    where oi.product_id=product_reviews.product_id and o.user_id=auth.uid() and o.paid_at is not null and o.status<>'cancelled'
  )
);
drop policy if exists "Customers update own reviews" on public.product_reviews;
create policy "Customers update own reviews" on public.product_reviews for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists "Customers delete own reviews" on public.product_reviews;
create policy "Customers delete own reviews" on public.product_reviews for delete to authenticated using (user_id=auth.uid());

create or replace function public.refresh_product_rating() returns trigger language plpgsql security definer set search_path='' as $$
declare target_product uuid:=coalesce(new.product_id,old.product_id);
begin
  update public.products set rating=coalesce((select round(avg(rating)::numeric,1) from public.product_reviews where product_id=target_product),0),updated_at=now() where id=target_product;
  return coalesce(new,old);
end; $$;
drop trigger if exists refresh_product_rating_after_review on public.product_reviews;
create trigger refresh_product_rating_after_review after insert or update or delete on public.product_reviews for each row execute function public.refresh_product_rating();

-- Remove any legacy/admin-entered score when there are no customer reviews.
update public.products p set rating=coalesce((select round(avg(r.rating)::numeric,1) from public.product_reviews r where r.product_id=p.id),0);

-- Product administration cannot set customer ratings.
create or replace function public.save_product_with_gallery(product_key uuid,payload jsonb,gallery jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare saved_id uuid;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if product_key is null then
    insert into public.products(category_id,name,slug,description,price,compare_at_price,image_url,badge,rating,inventory,is_active,variants)
    values(nullif(payload->>'category_id','')::uuid,payload->>'name',payload->>'slug',payload->>'description',(payload->>'price')::numeric,nullif(payload->>'compare_at_price','')::numeric,payload->>'image_url',payload->>'badge',0,(payload->>'inventory')::integer,(payload->>'is_active')::boolean,coalesce(payload->'variants','[]'::jsonb)) returning id into saved_id;
  else
    update public.products set category_id=nullif(payload->>'category_id','')::uuid,name=payload->>'name',slug=payload->>'slug',description=payload->>'description',price=(payload->>'price')::numeric,compare_at_price=nullif(payload->>'compare_at_price','')::numeric,image_url=payload->>'image_url',badge=payload->>'badge',inventory=(payload->>'inventory')::integer,is_active=(payload->>'is_active')::boolean,variants=coalesce(payload->'variants','[]'::jsonb),updated_at=now() where id=product_key returning id into saved_id;
  end if;
  if saved_id is null then raise exception 'Product was not found'; end if;
  delete from public.product_images where product_id=saved_id;
  insert into public.product_images(product_id,image_url,alt_text,sort_order) select saved_id,value#>>'{}',payload->>'name',ordinality-1 from jsonb_array_elements(gallery) with ordinality;
  return saved_id;
end; $$;
grant execute on function public.save_product_with_gallery(uuid,jsonb,jsonb) to authenticated;
