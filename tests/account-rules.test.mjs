import assert from "node:assert/strict";
import test from "node:test";
import { readDeliveryAddress, validateDeliveryAddress } from "../lib/account-rules.ts";
test("saved addresses are safely normalized and usable at checkout",()=>{
  const address=readDeliveryAddress({first_name:"Goodnews",last_name:"Udorji",phone:"0703 565 2752",line1:"12 Example Street",state:"Lagos",city:"Ikeja",unexpected:"ignored"});
  assert.equal(validateDeliveryAddress(address),"");
  assert.equal(address.additional_phone,"");
  assert.equal("unexpected" in address,false);
  assert.equal(readDeliveryAddress(null).line1,"");
  assert.equal(readDeliveryAddress({phone:123}).phone,"");
  assert.match(validateDeliveryAddress({...address,phone:"123"}),/phone/);
  assert.match(validateDeliveryAddress({...address,line1:""}),/street/);
  assert.match(validateDeliveryAddress({...address,city:""}),/city/);
});
