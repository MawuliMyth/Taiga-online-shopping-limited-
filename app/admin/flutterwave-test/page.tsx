"use client";
import {useState} from "react";
import Link from "next/link";
import {supabase} from "../../../lib/supabase";
export default function FlutterwaveTest(){
  const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
  async function run(verify=false){
    if(busy)return;setBusy(true);setMessage("");
    try{
      const {data}=await supabase.auth.getSession();
      if(!data.session)throw new Error("Sign in to the admin dashboard first.");
      const transaction_id=new URLSearchParams(window.location.search).get("transaction_id");
      if(verify&&!transaction_id)throw new Error("Complete a sandbox payment first, then return here.");
      const result=await fetch(`/api/flutterwave/test/${verify?"verify":"initialize"}`,{method:"POST",headers:{Authorization:`Bearer ${data.session.access_token}`,"Content-Type":"application/json"},body:JSON.stringify({transaction_id})});
      const payload=await result.json();if(!result.ok)throw new Error(payload.message||"Test failed.");
      if(verify)setMessage(payload.message);else window.location.assign(payload.url);
    }catch(error){setMessage(error instanceof Error?error.message:"Test unavailable.")}finally{setBusy(false)}
  }
  return <main style={{maxWidth:640,margin:"48px auto",padding:24}}><Link href="/admin">Back to admin</Link><h1>Flutterwave sandbox test</h1><p>Owner access and two-step verification required. This runs a ₦100 simulated payment using test credentials only. Do not use real card details.</p><p>No orders, revenue or inventory will change. Customer checkout remains unchanged.</p><div style={{display:"flex",gap:16,flexWrap:"wrap"}}><button disabled={busy} onClick={()=>void run()}>Start test payment</button><button disabled={busy} onClick={()=>void run(true)}>Verify returned test payment</button></div><p role="status">{busy?"Working…":message}</p></main>;
}
