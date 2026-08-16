-- Run after schema.sql. Safe to run more than once.
create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(), email text not null unique,
  created_at timestamptz not null default now()
);
alter table public.newsletter_subscribers enable row level security;
drop policy if exists "Anyone can subscribe" on public.newsletter_subscribers;
create policy "Anyone can subscribe" on public.newsletter_subscribers for insert with check (true);
drop policy if exists "Admins read subscribers" on public.newsletter_subscribers;
create policy "Admins read subscribers" on public.newsletter_subscribers for select using (public.is_admin());

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('product-images','product-images',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true;
drop policy if exists "Public product images" on storage.objects;
create policy "Public product images" on storage.objects for select using (bucket_id='product-images');
drop policy if exists "Admins upload product images" on storage.objects;
create policy "Admins upload product images" on storage.objects for insert with check (bucket_id='product-images' and public.is_admin());
drop policy if exists "Admins update product images" on storage.objects;
create policy "Admins update product images" on storage.objects for update using (bucket_id='product-images' and public.is_admin());
drop policy if exists "Admins delete product images" on storage.objects;
create policy "Admins delete product images" on storage.objects for delete using (bucket_id='product-images' and public.is_admin());

create or replace function public.checkout_cart(address jsonb)
returns public.orders language plpgsql security definer set search_path='' as $$
declare new_order public.orders; cart_total numeric(12,2); item record;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select coalesce(sum(p.price*c.quantity),0) into cart_total
  from public.cart_items c join public.products p on p.id=c.product_id
  where c.user_id=auth.uid() and p.is_active and p.inventory>=c.quantity;
  if cart_total<=0 then raise exception 'Your cart is empty or stock changed'; end if;
  insert into public.orders(user_id,status,subtotal,shipping,total,shipping_address)
  values(auth.uid(),'processing',cart_total,case when cart_total>=50000 then 0 else 2500 end,cart_total+case when cart_total>=50000 then 0 else 2500 end,address)
  returning * into new_order;
  for item in select c.product_id,c.quantity,p.name,p.price,p.inventory from public.cart_items c join public.products p on p.id=c.product_id where c.user_id=auth.uid() loop
    if item.inventory<item.quantity then raise exception 'Insufficient stock for %',item.name; end if;
    insert into public.order_items(order_id,product_id,product_name,unit_price,quantity) values(new_order.id,item.product_id,item.name,item.price,item.quantity);
    update public.products set inventory=inventory-item.quantity,updated_at=now() where id=item.product_id;
  end loop;
  delete from public.cart_items where user_id=auth.uid();
  return new_order;
end; $$;
grant execute on function public.checkout_cart(jsonb) to authenticated;

create table if not exists public.store_settings (
  id integer primary key default 1 check (id=1),
  store_name text not null default 'Taiga Online Shopping Limited',
  support_email text not null default 'support@taiga.ng',
  free_shipping_threshold numeric(12,2) not null default 75,
  updated_at timestamptz not null default now()
);
insert into public.store_settings(id) values(1) on conflict(id) do nothing;
alter table public.store_settings enable row level security;
drop policy if exists "Public read store settings" on public.store_settings;
create policy "Public read store settings" on public.store_settings for select using(true);
drop policy if exists "Admins update store settings" on public.store_settings;
create policy "Admins update store settings" on public.store_settings for update using(public.is_admin()) with check(public.is_admin());

-- Nigeria currency conversion: safely upgrades the original demo catalogue once.
update public.products set price=price*1000, compare_at_price=case when compare_at_price is null then null else compare_at_price*1000 end where price < 10000;
update public.store_settings set free_shipping_threshold=50000 where id=1;

alter table public.store_settings add column if not exists support_phone text not null default '0800 466 3639';
alter table public.store_settings add column if not exists announcement_left text not null default 'Free delivery on orders over ₦50,000';
alter table public.store_settings add column if not exists announcement_center text not null default 'Football celebration: save up to 50%';
alter table public.store_settings add column if not exists announcement_right text not null default 'Call / WhatsApp: 0800 466 3639';
alter table public.store_settings add column if not exists flash_sale_title text not null default 'Flash Sales';
alter table public.store_settings add column if not exists flash_sale_ends_at timestamptz default (now() + interval '1 day');
alter table public.store_settings add column if not exists revenue_reporting_started_at timestamptz;

create table if not exists public.banners (
  id uuid primary key default gen_random_uuid(),
  placement text not null check (placement in ('hero','side_top','side_bottom')),
  badge text,
  title text not null,
  accent_text text,
  subtitle text,
  image_url text not null,
  cta_label text not null default 'Shop now',
  cta_link text not null default '#deals',
  background_color text not null default '#eef6f2',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.banners add column if not exists image_urls jsonb not null default '[]'::jsonb;
update public.banners set image_urls=jsonb_build_array(image_url) where jsonb_array_length(image_urls)=0 and image_url is not null;
alter table public.banners enable row level security;
drop policy if exists "Public read active banners" on public.banners;
create policy "Public read active banners" on public.banners for select using(is_active and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>=now()) or public.is_admin());
drop policy if exists "Admins manage banners" on public.banners;
create policy "Admins manage banners" on public.banners for all using(public.is_admin()) with check(public.is_admin());

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  image_url text not null,
  alt_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists product_images_product_idx on public.product_images(product_id,sort_order);
alter table public.product_images enable row level security;
drop policy if exists "Public read product images" on public.product_images;
create policy "Public read product images" on public.product_images for select using(true);
drop policy if exists "Admins manage product images" on public.product_images;
create policy "Admins manage product images" on public.product_images for all using(public.is_admin()) with check(public.is_admin());
insert into public.product_images(product_id,image_url,alt_text,sort_order)
select id,image_url,name,0 from public.products p where not exists(select 1 from public.product_images pi where pi.product_id=p.id);

-- Keep the public brand settings aligned for existing installations.
update public.store_settings
set store_name = 'Taiga Online Shopping Limited',
    support_email = 'support@taiga.ng',
    updated_at = now()
where id = 1;
