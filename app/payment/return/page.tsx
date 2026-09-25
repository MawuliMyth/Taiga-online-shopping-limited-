"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Clock3, ShieldCheck, Mail, RefreshCw } from "lucide-react";
import styles from "./payment-return.module.css";
import { supabase } from "../../../lib/supabase";
import { AuthModal } from "../../components/AuthModal";

export default function PaymentReturn() {
  const [message,setMessage] = useState("Checking your payment…");
  const [busy,setBusy] = useState(true);
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
  return <main className={styles.page}>
    <div className={styles.shell}>
    <header className={styles.header}>
      <Link href="/" aria-label="Taiga home"><img src="/taiga-logo.png" alt="Taiga Online Shopping Limited" className={styles.logo}/></Link>
      <span><ShieldCheck size={17} aria-hidden="true"/> Payment status</span>
    </header>
    <section className={styles.card} aria-labelledby="payment-title" aria-busy={busy}>
      <div className={`${styles.icon} ${paid ? styles.confirmed : ""}`} aria-hidden="true">{paid ? <Check size={32}/> : busy ? <RefreshCw size={30} className={styles.spin}/> : <Clock3 size={32}/>}</div>
      <span className={styles.eyebrow}>{paid ? "PAYMENT CONFIRMED" : busy ? "VERIFYING PAYMENT" : "PAYMENT NOT YET CONFIRMED"}</span>
      <h1 id="payment-title">{paid ? "Thank you for your order" : busy ? "Checking your payment" : "Let’s check your payment"}</h1>
      <p className={styles.message} role="status" aria-live="polite">{message}</p>
      {reference && <div className={styles.reference}><span>Payment reference</span><strong>{reference}</strong><small>Keep this reference if you contact our support team.</small></div>}
      {!paid && <div className={styles.notice}><ShieldCheck size={21} aria-hidden="true"/><p><strong>Already been charged?</strong> Please don’t pay again while we check your payment.</p></div>}
      <div className={styles.actions}>
        {!paid && <button type="button" onClick={()=>void verify()} disabled={busy} className={styles.primary}><RefreshCw size={18} aria-hidden="true" className={busy ? styles.spin : ""}/>{busy ? "Checking payment…" : "Check payment again"}</button>}
        <Link href="/" className={paid ? styles.primary : styles.secondary}><ArrowLeft size={18} aria-hidden="true"/>Return to store</Link>
      </div>
      <a className={styles.support} href="mailto:sales@taigaonlineshoppinglimited.com"><Mail size={17} aria-hidden="true"/>Contact Taiga support</a>
    </section>
    <p className={styles.footnote}>Payments processed by Flutterwave</p>
    </div>
    {signIn && <AuthModal showGoogle={false} reason="Sign in to verify your payment" onClose={()=>{setSignIn(false);void supabase.auth.getSession().then(({data})=>{if(data.session)void verify()});}}/>}
  </main>;
}
