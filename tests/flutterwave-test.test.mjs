import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
const source=readFileSync('lib/flutterwave-test.ts','utf8');
function sandbox(){
  const exports={};let transaction;
  class CommerceError extends Error{constructor(message,status){super(message);this.status=status}}
  const context={exports,require:()=>({CommerceError}),process:{env:{FLUTTERWAVE_TEST_SECRET_KEY:'FLWSECK_TEST-example',FLUTTERWAVE_TEST_WEBHOOK_HASH:'x'.repeat(40)}},crypto:webcrypto,TextEncoder,AbortSignal,
    fetch:async()=>({ok:true,json:async()=>({status:'success',data:transaction})})};
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
  return {api:exports,context,set(value){transaction=value}};
}
test('sandbox rejects missing or live keys',()=>{
  const s=sandbox();s.context.process.env.FLUTTERWAVE_TEST_SECRET_KEY='FLWSECK-live';
  assert.throws(()=>s.api.testConfig(),/not been configured/);
});
test('verification binds signed reference, owner, exact amount and currency without fulfilling orders',async()=>{
  const s=sandbox();const ref=await s.api.testReference('owner-123');
  const payment={id:123,tx_ref:ref,status:'successful',currency:'NGN',amount:100};
  s.set(payment);assert.equal((await s.api.verifyTest(123,'owner-123')).test,true);
  for(const changed of [{amount:1},{currency:'USD'},{status:'failed'},{tx_ref:ref+'x'}]){
    s.set({...payment,...changed});await assert.rejects(()=>s.api.verifyTest(123,'owner-123'));
  }
  s.set(payment);await assert.rejects(()=>s.api.verifyTest(123,'different-owner'));
  assert.doesNotMatch(source,/finalize_paid_checkout|\.insert\(|\.update\(/);
});
