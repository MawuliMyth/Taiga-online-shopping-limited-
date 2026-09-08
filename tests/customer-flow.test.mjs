import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");
test("quantity updates keep the cart mounted and prevent duplicate requests",()=>{
  const source=read("../app/components/StorePanels.tsx");
  const quantity=source.slice(source.indexOf("async function quantity"),source.indexOf("async function remove"));
  assert.doesNotMatch(quantity,/await load\(|location\.|router\./);
  assert.match(quantity,/mutationLock.current/);
  assert.match(quantity,/setRows\(current/);
  assert.match(source,/disabled=\{updating\|\|row.quantity/);
});
test("product cart opens the shared drawer and orders show purchase snapshots",()=>{
  const product=read("../app/product/[slug]/page.tsx");
  assert.match(product,/<StorePanels kind="cart"/);
  assert.doesNotMatch(product,/href="\/account\/cart"/);
  const account=read("../app/account/[section]/page.tsx");
  assert.match(account,/Purchased products/);
  assert.match(account,/money\(item.unit_price\)/);
  assert.match(account,/eq\("user_id",userId\)/);
  assert.doesNotMatch(account,/"inbox"/);
  assert.doesNotMatch(read("../app/page.tsx"),/"inbox"|useSessionTimeout/);
});
