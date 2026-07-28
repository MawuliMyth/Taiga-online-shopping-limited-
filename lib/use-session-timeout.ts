"use client";

import { useEffect, useRef } from "react";
import { supabase } from "./supabase";

export function useSessionTimeout(minutes:number,onTimeout?:()=>void){
  const timeoutHandler=useRef(onTimeout);
  timeoutHandler.current=onTimeout;
  useEffect(()=>{
    const timeoutMs=minutes*60*1000;
    let lastActivity=Date.now();
    let lastRecorded=0;
    const recordActivity=()=>{
      const now=Date.now();
      if(now-lastRecorded<1000)return;
      lastRecorded=now;
      lastActivity=now;
    };
    const maintainSession=async()=>{
      const {data:{session}}=await supabase.auth.getSession();
      if(!session)return;
      if(Date.now()-lastActivity>=timeoutMs){
        await supabase.auth.signOut();
        timeoutHandler.current?.();
        return;
      }
      if(session.expires_at&&session.expires_at*1000-Date.now()<5*60*1000){
        await supabase.auth.refreshSession();
      }
    };
    const events=["pointerdown","keydown","touchstart","scroll"] as const;
    events.forEach(event=>window.addEventListener(event,recordActivity,{passive:true}));
    window.addEventListener("focus",maintainSession);
    const interval=window.setInterval(maintainSession,60*1000);
    maintainSession();
    return()=>{
      events.forEach(event=>window.removeEventListener(event,recordActivity));
      window.removeEventListener("focus",maintainSession);
      window.clearInterval(interval);
    };
  },[minutes]);
}
