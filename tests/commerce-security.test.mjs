import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const migration=await readFile(new URL("../supabase/migrations/202607150001_secure_commerce.sql",import.meta.url),"utf8");
const variantMigration=await readFile(new URL("../supabase/migrations/202607200001_product_variants.sql",import.meta.url),"utf8");
const reviewMigration=await readFile(new URL("../supabase/migrations/202607200002_verified_customer_reviews.sql",import.meta.url),"utf8");
const merchandisingMigration=await readFile(new URL("../supabase/migrations/202607220001_product_merchandising.sql",import.meta.url),"utf8");
const paidDeliveryMigration=await readFile(new URL("../supabase/migrations/202607280001_remove_free_delivery.sql",import.meta.url),"utf8");
const initializeRoute=await readFile(new URL("../app/api/paystack/initialize/route.ts",import.meta.url),"utf8");
const verifyRoute=await readFile(new URL("../app/api/paystack/verify/route.ts",import.meta.url),"utf8");

test("payment endpoints require an authenticated Supabase user",()=>{
  assert.match(initializeRoute,/authenticatedUser\(request\)/);
  assert.match(verifyRoute,/authenticatedUser\(request\)/);
  assert.match(verifyRoute,/metadata\?\.user_id!==user\.id/);
});

test("payment references are unique and cannot be reused",()=>{
  assert.match(migration,/reference text primary key/);
  assert.match(migration,/Payment reference has already been used/);
  assert.match(migration,/payment_reference text unique/);
});

test("checkout locks and conditionally decrements inventory",()=>{
  assert.match(migration,/for update of p/i);
  assert.match(migration,/inventory>=item\.quantity/);
  assert.match(migration,/if not found then raise exception 'Insufficient stock/i);
});

test("delivery pricing comes from store settings",()=>{
  assert.match(migration,/settings\.pickup_shipping_fee/);
  assert.match(migration,/settings\.free_shipping_threshold/);
  assert.match(migration,/settings\.standard_shipping_fee/);
});

test("standard and pickup delivery remain paid at every cart value",()=>{
  assert.match(paidDeliveryMigration,/delivery_method='pickup' then settings\.pickup_shipping_fee else settings\.standard_shipping_fee/i);
  assert.doesNotMatch(paidDeliveryMigration,/subtotal>=settings\.free_shipping_threshold/i);
});

test("commerce mutations are restricted by RLS or server role",()=>{
  assert.match(migration,/enable row level security/);
  assert.match(migration,/revoke all on function public\.finalize_paid_checkout[\s\S]*authenticated/);
  assert.match(migration,/grant execute on function public\.finalize_paid_checkout[\s\S]*service_role/);
  assert.match(migration,/if not public\.is_admin\(\)/);
});

test("checkout prices and deducts the exact selected variant",()=>{
  assert.match(variantMigration,/primary key \(user_id, product_id, variant_key\)/i);
  assert.match(variantMigration,/selected_variant jsonb/i);
  assert.match(variantMigration,/item->>'id'=c\.variant_key/i);
  assert.match(variantMigration,/jsonb_set\(value,'\{inventory\}'/i);
  assert.match(variantMigration,/A selected product variant is unavailable or out of stock/i);
});

test("ratings are calculated only from verified customer reviews",()=>{
  assert.match(reviewMigration,/create table if not exists public\.product_reviews/i);
  assert.match(reviewMigration,/o\.paid_at is not null and o\.status<>'cancelled'/i);
  assert.match(reviewMigration,/unique\(product_id,user_id\)/i);
  assert.match(reviewMigration,/round\(avg\(rating\)::numeric,1\)/i);
  assert.match(reviewMigration,/Product administration cannot set customer ratings/i);
});

test("product policies and merchandising are admin managed",()=>{
  assert.match(merchandisingMigration,/specifications jsonb/i);
  assert.match(merchandisingMigration,/warranty_value integer/i);
  assert.match(merchandisingMigration,/returnable boolean/i);
  assert.match(merchandisingMigration,/sales_count integer/i);
  assert.match(merchandisingMigration,/increment_product_sales_after_order/i);
});
