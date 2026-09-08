import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const reset=readFileSync('supabase/migrations/202609080002_production_order_reset.sql','utf8');
const audit=readFileSync('supabase/migrations/202609080003_admin_audit_coverage.sql','utf8');
test('reset requires owner authority, exact confirmation and a locked order snapshot',()=>{
  for(const text of ['public.is_owner()',"'DELETE ALL ORDERS'",'lock table public.orders in exclusive mode','actual_ids is distinct from requested_ids']) assert.ok(reset.includes(text));
  assert.match(reset,/update public.payment_transactions set order_id=null/);
  assert.match(reset,/orders.production_reset/);
  assert.doesNotMatch(reset,/delete from public\.(products|profiles|admin_audit_logs|payment_transactions)/);
});
test('catalogue changes have transactional admin-only audit triggers without row contents',()=>{
  assert.match(audit,/if not public.is_admin\(\) then return null/);
  assert.match(audit,/after insert or update or delete/);
  assert.match(audit,/changed_fields/);
  assert.doesNotMatch(audit,/jsonb_build_object\('.*',before_row/);
});
