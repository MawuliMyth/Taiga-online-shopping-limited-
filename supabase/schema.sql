-- Taiga Online Shopping Limited database schema. Run once in Supabase SQL Editor.
create extension if not exists pgcrypto;

create type public.user_role as enum ('customer', 'admin');
create type public.order_status as enum ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  role public.user_role not null default 'customer',
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  image_url text,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  description text,
  price numeric(12,2) not null check (price >= 0),
  compare_at_price numeric(12,2) check (compare_at_price is null or compare_at_price >= price),
  image_url text not null,
  badge text,
  rating numeric(2,1) not null default 0 check (rating between 0 and 5),
  inventory integer not null default 0 check (inventory >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.wishlist_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table public.cart_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null default 1 check (quantity between 1 and 99),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('GN-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  user_id uuid not null references auth.users(id),
  status public.order_status not null default 'pending',
  subtotal numeric(12,2) not null check (subtotal >= 0),
  shipping numeric(12,2) not null default 0 check (shipping >= 0),
  total numeric(12,2) not null check (total >= 0),
  shipping_address jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  unit_price numeric(12,2) not null,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now()
);

create index products_category_idx on public.products(category_id);
create index products_active_idx on public.products(is_active);
create index orders_user_idx on public.orders(user_id);
create index orders_created_idx on public.orders(created_at desc);
create index order_items_order_idx on public.order_items(order_id);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name) values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy "Public can read categories" on public.categories for select using (true);
create policy "Public can read active products" on public.products for select using (is_active or public.is_admin());
create policy "Admins manage categories" on public.categories for all using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage products" on public.products for all using (public.is_admin()) with check (public.is_admin());
create policy "Users read own profile" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "Users update own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "Users manage own wishlist" on public.wishlist_items for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users manage own cart" on public.cart_items for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users read own orders" on public.orders for select using (user_id = auth.uid() or public.is_admin());
create policy "Users create own orders" on public.orders for insert with check (user_id = auth.uid());
create policy "Admins update orders" on public.orders for update using (public.is_admin()) with check (public.is_admin());
create policy "Users read own order items" on public.order_items for select using (exists(select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())));
create policy "Users create own order items" on public.order_items for insert with check (exists(select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));

-- Customers may edit profile presentation fields, never their own role.
revoke update on public.profiles from authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;

insert into public.categories (name, slug, image_url) values
('Electronics','electronics','https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=400&q=80'),
('Fashion','fashion','https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?auto=format&fit=crop&w=400&q=80'),
('Computing','computing','https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=400&q=80'),
('Mobile','mobile','https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=400&q=80'),
('Beauty','beauty','https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=400&q=80'),
('Groceries','groceries','https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80');

insert into public.products (category_id,name,slug,price,compare_at_price,rating,badge,image_url,inventory) values
((select id from public.categories where slug='electronics'),'Pulse Pro Wireless Headphones','pulse-pro-headphones',129,179,4.8,'-28%','https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=700&q=85',48),
((select id from public.categories where slug='mobile'),'Nova X Smartphone 256GB','nova-x-smartphone',699,799,4.9,'Bestseller','https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=700&q=85',22),
((select id from public.categories where slug='computing'),'AeroBook Air 14-inch','aerobook-air',899,1049,4.7,'Hot','https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=700&q=85',17),
((select id from public.categories where slug='fashion'),'Everyday Leather Carryall','leather-carryall',84,110,4.6,'-24%','https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=700&q=85',35),
((select id from public.categories where slug='fashion'),'Cloud Runner Sneakers','cloud-runner-sneakers',96,135,4.8,'New','https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=700&q=85',63),
((select id from public.categories where slug='beauty'),'Glow Ritual Skincare Set','glow-ritual-skincare',58,72,4.9,'-20%','https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=700&q=85',41),
((select id from public.categories where slug='electronics'),'Arc Smart Watch Series 5','arc-smart-watch',219,259,4.7,'Popular','https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=700&q=85',28),
((select id from public.categories where slug='groceries'),'Stoneware Home Set','stoneware-home-set',42,55,4.5,'-23%','https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=700&q=85',54);
