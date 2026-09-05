import test from "node:test";
import assert from "node:assert/strict";
import { calculateDelivery, cartPackedWeight, validRate } from "../lib/taiga-delivery.ts";
const rate={id:"test",state:"Lagos",city:"*",enabled:true,base_fee:2000,included_kg:2,extra_per_kg:500,max_kg:20,min_days:2,max_days:5,surcharge:100,round_up:true};
test("destination base, excess kg, surcharge and rounding",()=>{
  assert.equal(calculateDelivery([rate],"Lagos","Badagry",2).amount,2100);
  assert.equal(calculateDelivery([rate],"Lagos","Badagry",4).amount,3100);
  assert.equal(calculateDelivery([rate],"Lagos","Badagry",2.1).amount,2600);
  assert.equal(calculateDelivery([{...rate,round_up:false}],"Lagos","Badagry",2.1).amount,2150);
});
test("city override wins; disabled city cannot fall back to state",()=>{
  const city={...rate,id:"city",city:"Badagry",base_fee:3000};
  assert.equal(calculateDelivery([rate,city],"lagos","badagry",2).amount,3100);
  assert.throws(()=>calculateDelivery([rate,{...city,enabled:false}],"Lagos","Badagry",2),/Contact Taiga/);
});
test("missing, draft, malformed and overweight rates never become free shipping",()=>{
  assert.throws(()=>calculateDelivery([],"Lagos","Ikeja",1),/Contact Taiga/);
  for(const change of [{enabled:false},{base_fee:null},{extra_per_kg:-1},{min_days:6}])assert.throws(()=>calculateDelivery([{...rate,...change}],"Lagos","Ikeja",1));
  assert.throws(()=>calculateDelivery([rate],"Lagos","Ikeja",21),/limit/);
  assert.equal(validRate({...rate,base_fee:null}),false);
  assert.equal(calculateDelivery([{...rate,base_fee:0,surcharge:0}],"Lagos","Ikeja",1).amount,0);
});
test("packed weights multiply by quantity with no dummy weight",()=>{
  assert.equal(cartPackedWeight([{quantity:2,products:{specifications:{"Shipping Weight (kg)":"2"}}}]),4);
  assert.throws(()=>cartPackedWeight([{quantity:1,products:{specifications:{}}}]),/packed weight/);
  assert.throws(()=>cartPackedWeight([{quantity:1,products:{specifications:{"Shipping Weight (kg)":"2","Bulky item":"yes"}}}]),/Bulky/);
});
