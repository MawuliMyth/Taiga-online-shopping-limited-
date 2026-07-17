-- Repairs the live catalogue safely. This script can be run repeatedly.
-- Existing admin edits are preserved; only missing categories/products are created.

insert into public.categories (name, slug, image_url) values
('Electronics','electronics','https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=400&q=80'),
('Fashion','fashion','https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?auto=format&fit=crop&w=400&q=80'),
('Computing','computing','https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=400&q=80'),
('Mobile','mobile','https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=400&q=80'),
('Beauty','beauty','https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=400&q=80'),
('Groceries','groceries','https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80')
on conflict (slug) do nothing;

insert into public.products (category_id,name,slug,description,price,compare_at_price,rating,badge,image_url,inventory,is_active) values
((select id from public.categories where slug='electronics'),'Pulse Pro Wireless Headphones','pulse-pro-headphones','Immersive wireless headphones with clear sound, comfortable cushioning and dependable all-day battery life.',129000,179000,4.8,'-28%','https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=700&q=85',48,true),
((select id from public.categories where slug='mobile'),'Nova X Smartphone 256GB','nova-x-smartphone','A responsive 256GB smartphone with a vivid display, capable cameras and reliable everyday performance.',699000,799000,4.9,'Bestseller','https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=700&q=85',22,true),
((select id from public.categories where slug='computing'),'AeroBook Air 14-inch','aerobook-air','A slim 14-inch notebook designed for productive work, study and entertainment on the move.',899000,1049000,4.7,'Hot','https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=700&q=85',17,true),
((select id from public.categories where slug='fashion'),'Everyday Leather Carryall','leather-carryall','A versatile carryall with a roomy interior and polished finish for work, travel and everyday use.',84000,110000,4.6,'-24%','https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=700&q=85',35,true),
((select id from public.categories where slug='fashion'),'Cloud Runner Sneakers','cloud-runner-sneakers','Lightweight everyday sneakers combining cushioned support, breathable comfort and modern styling.',96000,135000,4.8,'New','https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=700&q=85',63,true),
((select id from public.categories where slug='beauty'),'Glow Ritual Skincare Set','glow-ritual-skincare','A balanced skincare routine created to cleanse, hydrate and support a healthy-looking complexion.',58000,72000,4.9,'-20%','https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=700&q=85',41,true),
((select id from public.categories where slug='electronics'),'Arc Smart Watch Series 5','arc-smart-watch','A polished smart watch with activity tracking, useful notifications and an easy-to-read display.',219000,259000,4.7,'Popular','https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=700&q=85',28,true),
((select id from public.categories where slug='groceries'),'Stoneware Home Set','stoneware-home-set','A coordinated stoneware set with a timeless finish for daily meals and relaxed entertaining.',42000,55000,4.5,'-23%','https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=700&q=85',54,true)
on conflict (slug) do nothing;

insert into public.product_images (product_id,image_url,alt_text,sort_order)
select p.id,p.image_url,p.name,0 from public.products p
where not exists (select 1 from public.product_images i where i.product_id=p.id);
