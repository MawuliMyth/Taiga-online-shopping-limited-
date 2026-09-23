// Isolated PostgreSQL engine; never connects to or modifies the live Supabase database.
// npm install --prefix tmp/flutterwave-sql-check --no-audit --no-fund @electric-sql/pglite
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
const dependency='../tmp/flutterwave-sql-check/node_modules/@electric-sql/pglite/dist/index.js';
let PGlite;
try { ({PGlite}=await import(dependency)); } catch { /* opt-in isolated database test dependency */ }

test('Flutterwave checkout snapshots, atomic stock, replay protection and review handling', {skip:!PGlite}, async()=>{
  const db=new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create table auth.users(id uuid primary key,email text);
      create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
      create function public.is_admin() returns boolean language sql as $$ select false $$;`);
    const original=readFileSync('supabase/schema.sql','utf8');
    const tables=original.slice(original.indexOf('create type'),original.indexOf('create index products_category_idx'));
    await db.exec(tables);
    await db.exec(`alter table products add variants jsonb not null default '[]';
      alter table cart_items add variant_key text not null default 'default';
      alter table cart_items add selected_variant jsonb;
      alter table cart_items drop constraint cart_items_pkey;
      alter table cart_items add primary key(user_id,product_id,variant_key);
      alter table order_items add selected_variant jsonb;
      alter table orders add payment_reference text unique;
      alter table orders add paid_at timestamptz;
      create table payment_transactions(reference text primary key,user_id uuid,order_id uuid unique references orders(id),amount_minor bigint,currency text,status text,provider text);
      create table admin_audit_logs(actor_id uuid not null references auth.users(id),action text,entity_type text,entity_id text,details jsonb);`);
    await db.exec(readFileSync('supabase/migrations/202609230001_flutterwave_checkout.sql','utf8'));
    const user=randomUUID(),product=randomUUID();
    await db.query('insert into auth.users values($1,$2)',[user,'buyer@example.com']);
    await db.query("insert into products(id,name,slug,price,image_url,inventory) values($1,'Phone','phone',100,'/phone.png',10)",[product]);
    const address={first_name:'Test',last_name:'Buyer',phone:'08030000000',line1:'1 Test road',city:'Ikeja',state:'Lagos',delivery_method:'standard',delivery_payment:'courier_separately'};
    async function cart(qty=2,key='default'){await db.query('insert into cart_items(user_id,product_id,quantity,variant_key) values($1,$2,$3,$4) on conflict(user_id,product_id,variant_key) do update set quantity=excluded.quantity,updated_at=now()',[user,product,qty,key]);}
    async function create(amount=20000,id=randomUUID()){return (await db.query('select create_flutterwave_checkout($1,$2,$3,$4) as result',[user,id,address,amount])).rows[0].result;}
    async function finish(ref,id,amount=20000,currency='NGN',email='buyer@example.com'){return (await db.query('select finalize_flutterwave_checkout($1,$2,$3,$4,$5) as result',[ref,id,amount,currency,email])).rows[0].result;}
    await cart();
    await assert.rejects(()=>create(1),/Prices have changed/);
    const request=randomUUID(),first=await create(20000,request);
    assert.equal((await create(20000,request)).reference,first.reference);
    // Subsequent catalogue and cart changes must not change this payment's purchased snapshot.
    await db.query('update products set price=150 where id=$1',[product]);await cart(3);
    const paid=await finish(first.reference,'100');assert.equal(paid.status,'paid');
    assert.equal((await finish(first.reference,'100')).order_number,paid.order_number);
    assert.equal((await db.query('select inventory from products')).rows[0].inventory,8);
    assert.equal((await db.query('select total,shipping from orders')).rows[0].total,'200.00');
    assert.equal((await db.query('select count(*)::int n from cart_items')).rows[0].n,1);
    assert.equal((await finish(first.reference,'101')).status,'review');
    assert.equal((await db.query('select count(*)::int n from orders')).rows[0].n,1);
    const second=await create(45000);
    await db.query('update products set inventory=0 where id=$1',[product]);
    assert.equal((await finish(second.reference,'102',45000)).status,'review');
    assert.equal((await db.query('select inventory from products')).rows[0].inventory,0);
    await db.query('update products set inventory=10 where id=$1',[product]);
    for(const [id,amount,currency,email] of [['103',1,'NGN','buyer@example.com'],['104',45000,'USD','buyer@example.com'],['105',45000,'NGN','other@example.com']]){
      const intent=await create(45000);assert.equal((await finish(intent.reference,id,amount,currency,email)).status,'review');
    }
    // Atomic variant fulfilment and untouched other variant stock.
    await db.query('delete from cart_items where user_id=$1',[user]);
    await db.query('update products set variants=$1,inventory=9 where id=$2',[JSON.stringify([{id:'blue',price:175,inventory:5,options:{Colour:'Blue'}},{id:'black',price:200,inventory:4,options:{Colour:'Black'}}]),product]);
    await cart(2,'blue');const variantCheckout=await create(35000);
    assert.equal((await finish(variantCheckout.reference,'106',35000)).status,'paid');
    const stocked=(await db.query('select variants,inventory from products')).rows[0];
    assert.equal(stocked.variants[0].inventory,3);assert.equal(stocked.variants[1].inventory,4);assert.equal(stocked.inventory,7);
    assert.equal((await db.query('select count(*)::int n from cart_items')).rows[0].n,0);
    await cart(1,'default');await assert.rejects(()=>create(15000),/Choose a variant/);
    // No public or customer may call service-role finalization or see payment snapshots.
    assert.equal((await db.query("select has_function_privilege('authenticated','public.finalize_flutterwave_checkout(text,text,bigint,text,text)','execute') as allowed")).rows[0].allowed,false);
    assert.equal((await db.query("select has_function_privilege('anon','public.create_flutterwave_checkout(uuid,uuid,jsonb,bigint)','execute') as allowed")).rows[0].allowed,false);
  } finally { await db.close(); }
});
