"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
const preference="taiga-analytics-consent";
export function VisitorCounter(){
  const path=usePathname();const [consent,setConsent]=useState<string|null>(null);const [ready,setReady]=useState(false);
  const eligible=path==="/"||path==="/shop"||path==="/search"||path?.startsWith("/product/")||path?.startsWith("/help/");
  useEffect(()=>{try{setConsent(localStorage.getItem(preference))}catch{}setReady(true)},[]);
  useEffect(()=>{
    if(consent!=="yes"||!eligible||!path||navigator.doNotTrack==="1"||(navigator as Navigator&{globalPrivacyControl?:boolean}).globalPrivacyControl)return;
    try{
      const now=Date.now();let visitor=JSON.parse(localStorage.getItem("taiga-visitor")||"null");
      if(!visitor||now-visitor.created>30*86400000){visitor={id:crypto.randomUUID(),created:now};localStorage.setItem("taiga-visitor",JSON.stringify(visitor))}
      let visit=JSON.parse(sessionStorage.getItem("taiga-visit")||"null");
      if(!visit||now-visit.last>30*60000){let source="Direct";try{const url=new URL(document.referrer);if(url.host!==location.host)source=url.hostname}catch{}visit={id:crypto.randomUUID(),source,last:now}}
      visit.last=now;sessionStorage.setItem("taiga-visit",JSON.stringify(visit));
      const last=JSON.parse(sessionStorage.getItem("taiga-view")||"null");
      if(last?.path===path&&now-last.time<2000)return;
      sessionStorage.setItem("taiga-view",JSON.stringify({path,time:now}));
      void fetch("/api/analytics",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:crypto.randomUUID(),visitor_id:visitor.id,session_id:visit.id,path,source:visit.source,device:innerWidth<768?"mobile":innerWidth<1024?"tablet":"desktop"}),keepalive:true}).catch(()=>{});
    }catch{ /* Analytics never interrupts shopping. */ }
  },[path,consent,eligible]);
  function choose(value:string){try{localStorage.setItem(preference,value);if(value==="no"){localStorage.removeItem("taiga-visitor");sessionStorage.removeItem("taiga-visit");sessionStorage.removeItem("taiga-view")}}catch{}setConsent(value)}
  if(!ready||!eligible)return null;
  return consent===null?<aside className="visitor-consent" aria-label="Optional visitor statistics"><p>Allow anonymous visitor statistics? We count visits and popular pages without collecting your name, email or IP address. Shopping works either way.</p><div><button type="button" onClick={()=>choose("no")}>No thanks</button><button type="button" onClick={()=>choose("yes")}>Allow statistics</button></div></aside>:<button type="button" className="visitor-preferences" onClick={()=>setConsent(null)}>Privacy choices</button>;
}
