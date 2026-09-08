import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function harness(enabled=true){
  let now=1000,interval,cleanup,signouts=0,timeouts=0;
  const events=new Map();
  const auth={getSession:async()=>({data:{session:{expires_at:9999999999}}}),signOut:async options=>{assert.equal(options.scope,"local");signouts++;return {error:null}},refreshSession:async()=>({error:null})};
  const module={exports:{}};
  const code=ts.transpileModule(readFileSync(new URL("../lib/use-session-timeout.ts",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  vm.runInNewContext(code,{exports:module.exports,module,Date:{now:()=>now},require:name=>name==="react"?{useRef:value=>({current:value}),useEffect:fn=>{const result=fn();if(result)cleanup=result}}:{supabase:{auth}},window:{addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:name=>events.delete(name),setInterval:fn=>{interval=fn;return 1},clearInterval:()=>{interval=null}}});
  module.exports.useSessionTimeout(60,()=>timeouts++,enabled);
  return {advance:ms=>{now+=ms},tick:async()=>{await Promise.resolve();await Promise.resolve();await interval?.()},activity:name=>events.get(name)?.(),counts:()=>({signouts,timeouts}),events,cleanup:()=>cleanup?.()};
}
test("admin timer waits a full hour and every activity restarts it",async()=>{
  const timer=harness();await timer.tick();
  for(const event of ["pointerdown","pointermove","keydown","input","touchstart","wheel","scroll"]){timer.advance(59*60000);timer.activity(event);await timer.tick();assert.equal(timer.counts().signouts,0)}
  timer.advance(59*60000);await timer.tick();assert.equal(timer.counts().signouts,0);
  timer.advance(60000);await timer.tick();assert.deepEqual(timer.counts(),{signouts:1,timeouts:1});
  timer.cleanup();assert.equal(timer.events.size,0);
});
test("admin inactivity checks do not start before access is granted",async()=>{
  const timer=harness(false);timer.advance(120*60000);await timer.tick();assert.equal(timer.events.size,0);assert.equal(timer.counts().signouts,0);
});
