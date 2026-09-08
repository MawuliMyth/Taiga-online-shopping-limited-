"use client";

import { useEffect, useRef } from "react";
import { supabase } from "./supabase";

export function useSessionTimeout(minutes:number,onTimeout?:()=>void,enabled=true){
  const timeoutHandler=useRef(onTimeout);
  useEffect(()=>{timeoutHandler.current=onTimeout},[onTimeout]);
  useEffect(()=>{
    if(!enabled)return;
    const timeoutMs=Math.max(1,minutes)*60*1000;
    let lastActivity=Date.now();
    let lastRecorded=0;
    let checking=false;
    const channel=typeof BroadcastChannel!=="undefined"?new BroadcastChannel("taiga-session-activity"):null;
    if(channel)channel.onmessage=event=>{if(event.data==="activity")lastActivity=Date.now()};
    const recordActivity=()=>{
      const now=Date.now();
      if(now-lastRecorded<1000)return;
      lastRecorded=now;
      lastActivity=now;
      channel?.postMessage("activity");
    };
    const maintainSession=async()=>{
      if(checking)return;
      checking=true;
      try{
        const {data:{session}}=await supabase.auth.getSession();
        if(!session)return;
        if(Date.now()-lastActivity>=timeoutMs){
          const {error}=await supabase.auth.signOut({scope:"local"});
          if(error)return;
          timeoutHandler.current?.();
          return;
        }
        if(session.expires_at&&session.expires_at*1000-Date.now()<5*60*1000){
          await supabase.auth.refreshSession();
        }
      }catch{ /* A temporary network failure is not an inactivity timeout. */ }
      finally{checking=false}
    };
    const events=["pointerdown","pointermove","keydown","input","touchstart","wheel","scroll"] as const;
    events.forEach(event=>window.addEventListener(event,recordActivity,{passive:true,capture:true}));
    window.addEventListener("focus",maintainSession);
    const interval=window.setInterval(maintainSession,60*1000);
    maintainSession();
    return()=>{
      events.forEach(event=>window.removeEventListener(event,recordActivity,true));
      channel?.close();
      window.removeEventListener("focus",maintainSession);
      window.clearInterval(interval);
    };
  },[minutes,enabled]);
}
