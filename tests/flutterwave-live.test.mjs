import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';

const source=readFileSync('lib/flutterwave.ts','utf8');
function setup(){
  const exports={};
  class CommerceError extends Error {constructor(message,status){super(message);this.status=status}}
  const context={exports,require:()=>({CommerceError}),process:{env:{FLUTTERWAVE_SECRET_KEY:'FLWSECK-live-fixture',FLUTTERWAVE_WEBHOOK_HASH:'x'.repeat(40)}},crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,AbortSignal};
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
  return {api:exports,context};
}
test('live configuration rejects test credentials and requires explicit checkout activation',()=>{
  const {api,context}=setup();assert.throws(()=>api.requireCheckoutEnabled());
  context.process.env.FLUTTERWAVE_CHECKOUT_ENABLED='true';api.requireCheckoutEnabled();
  context.process.env.FLUTTERWAVE_SECRET_KEY='FLWSECK_TEST-example';assert.throws(()=>api.liveConfig());
});
test('currency parsing is exact and rejects fractional kobo and unsafe input',()=>{
  const {api}=setup();assert.equal(api.amountMinor('1837600.01'),183760001);
  assert.equal(api.amountMinor(100),10000);
  for(const value of ['1.001','NaN',0,-2,'1e3','Infinity',null])assert.throws(()=>api.amountMinor(value));
});
test('webhook secret must match exactly',async()=>{
  const {api}=setup();assert.equal(await api.webhookAuthorized('x'.repeat(40)),true);
  assert.equal(await api.webhookAuthorized('x'.repeat(39)+'y'),false);
  assert.equal(await api.webhookAuthorized(null),false);
});
test('verified payment must be successful and match the exact reference and provider ID',()=>{
  const {api}=setup();const reference='taiga-live-11111111-1111-4111-8111-111111111111';
  const valid={id:123,tx_ref:reference,status:'successful',amount:100,currency:'NGN',customer:{email:'customer@example.com'}};
  assert.equal(api.validateVerifiedPayment(valid,reference,'123').amount,10000);
  for(const change of [{id:124},{tx_ref:'other'},{status:'failed'},{customer:{}},{amount:'0.001'}])
    assert.throws(()=>api.validateVerifiedPayment({...valid,...change},reference,'123'));
});
test('oversized and malformed bodies are rejected',async()=>{
  const {api}=setup();await assert.rejects(()=>api.readPaymentJson(new Request('https://example.com',{method:'POST',body:'x'.repeat(30)}),10));
  await assert.rejects(()=>api.readPaymentJson(new Request('https://example.com',{method:'POST',body:'oops'})));
  assert.equal((await api.readPaymentJson(new Request('https://example.com',{method:'POST',body:'{"ok":true}'}))).ok,true);
});
