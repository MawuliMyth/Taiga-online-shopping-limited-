import assert from "node:assert/strict";
import test from "node:test";
import { parcelForCart, referenceRate } from "../lib/shipping-rules.ts";
const row=()=>({variant_key:"default",quantity:2,products:{name:"Laptop",is_active:true,inventory:5,price:100000,variants:[],specifications:{"Shipping Weight (kg)":"2","Package Length (cm)":"40","Package Width (cm)":"30","Package Height (cm)":"10","Shipbubble Category ID":"1"}}});
test("parcel uses catalogue price and packed weight, including quantity",()=>{
  const item=row();item.selected_variant={price:1};
  const parcel=parcelForCart([item]);
  assert.equal(parcel.package_items[0].unit_amount,100000);
  assert.equal(parcel.package_items[0].unit_weight,2);
  assert.deepEqual(parcel.package_dimension,{length:40,width:30,height:20});
});
test("unknown dimensions, mixed categories and unavailable inventory require a manual quote",()=>{
  const item=row();delete item.products.specifications["Package Height (cm)"];
  assert.throws(()=>parcelForCart([item]),/package details/);
  const other=row();other.products.specifications["Shipbubble Category ID"]="2";
  assert.throws(()=>parcelForCart([row(),other]),/mixed parcel/);
  const unavailable=row();unavailable.quantity=6;
  assert.throws(()=>parcelForCart([unavailable]),/availability/);
});
test("only positive NGN pickup retail rates are eligible",()=>{
  const rate={service_type:"pickup",rate_card_currency:"NGN",rate_card_amount:3000,total:1};
  assert.equal(referenceRate([rate,{...rate,rate_card_amount:2500},{...rate,service_type:"dropoff",rate_card_amount:100},{...rate,rate_card_currency:"USD",rate_card_amount:1}]),2500);
  assert.throws(()=>referenceRate([{...rate,rate_card_amount:0}]),/No delivery/);
  assert.throws(()=>referenceRate([]),/No delivery/);
});
