import assert from "node:assert/strict";
import test from "node:test";
import { analyticsEvent } from "../lib/analytics-rules.ts";
const valid={id:"71abc5bc-c7a7-49bf-8a9f-e3f4a2a279f9",visitor_id:"71abc5bc-c7a7-49bf-8a9f-e3f4a2a279f9",session_id:"71abc5bc-c7a7-49bf-8a9f-e3f4a2a279f9",path:"/product/phone",source:"google.com",device:"mobile"};
test("visitor event whitelist excludes account URLs, queries and personal fields",()=>{
 assert.equal(analyticsEvent(valid).path,"/product/phone");
 assert.equal("email" in analyticsEvent({...valid,email:"private@example.com"}),false);
 for(const path of ["/account/orders","/admin","/search?q=private","https://other.example/","/product/a?email=private"]){assert.throws(()=>analyticsEvent({...valid,path}))}
 assert.throws(()=>analyticsEvent({...valid,id:"invalid"}));assert.throws(()=>analyticsEvent({...valid,source:"https://example.com/private"}));
});
