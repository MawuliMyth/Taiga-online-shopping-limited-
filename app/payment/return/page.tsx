"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";
import { AuthModal } from "../../components/AuthModal";

export default function PaymentReturn() {
  const [message,setMessage] = useState("Checking your payment…");
  const [busy,setBusy] = useState(false);
  const [reference,setReference] = useState("");
  const [paid,setPaid] = useState(false);
  const [signIn,setSignIn] = useState(false);
  const locked = useRef(false);
  const verify = useCallback(async () => {
    if (locked.current) return;
    locked.current = true; setBusy(true);
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("tx_ref") ?? "";
      setReference(ref);
      if (!ref) throw new Error("No payment reference was supplied. Contact support if you made a payment.");
      const { data } = await supabase.auth.getSession();
      if (!data.session) { setSignIn(true); throw new Error("Sign in to the account used at checkout to see your payment result."); }
      // Never trust the callback status or its amount. Verify server-side, including cancelled callbacks.
      const response = await fetch("/api/flutterwave/verify", {
        method:"POST", headers:{ Authorization:`Bearer ${data.session.access_token}`, "Content-Type":"application/json" },
        body:JSON.stringify({ reference:ref, transaction_id:params.get("transaction_id") || undefined }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "We could not verify your payment yet.");
      if (result.status === "paid") {
        setPaid(true); setMessage(result.order_number ? `Payment confirmed. Your order is ${result.order_number}. Delivery is paid separately to the courier.` : "This payment was already processed. Contact support if you cannot find your order.");
      } else {
        setMessage("Your payment was received and needs a review by Taiga. Do not pay again. Contact sales@taigaonlineshoppinglimited.com with the reference below.");
      }
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Verification is temporarily unavailable. Do not pay again if you were debited."); }
    finally { setBusy(false); locked.current=false; }
  }, []);
  useEffect(()=>{ void verify(); },[verify]);
  return <main style={{maxWidth:640,margin:"48px auto",padding:24,lineHeight:1.7}}>
    <Link href="/">Taiga Online Shopping Limited</Link>
    <h1>{paid ? "Thank you for your order" : "Payment status"}</h1>
    <p role="status" aria-live="polite">{message}</p>
    {reference && <p style={{overflowWrap:"anywhere"}}>Payment reference: <strong>{reference}</strong></p>}
    <div style={{display:"flex",gap:16,flexWrap:"wrap",marginTop:24}}>
      {!paid && <button type="button" onClick={()=>void verify()} disabled={busy} style={{padding:"12px 20px",background:"var(--primary, #087f68)",color:"white",borderRadius:8}}>{busy ? "Verifying…" : "Check payment again"}</button>}
      <Link href="/">Return to store</Link><a href="mailto:sales@taigaonlineshoppinglimited.com">Contact support</a>
    </div>
    {!paid && <p>If money left your account, do not make another payment while verification is pending.</p>}
    {signIn && <AuthModal showGoogle={false} reason="Sign in to verify your payment" onClose={()=>{setSignIn(false);void supabase.auth.getSession().then(({data})=>{if(data.session)void verify()});}}/>}
  </main>;
}
