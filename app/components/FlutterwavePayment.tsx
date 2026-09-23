"use client";
import { useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { supabase } from "../../lib/supabase";

export function FlutterwavePayment({ total, address, onBack }: { total: number; address: Record<string,string>; onBack: () => void }) {
  const locked = useRef(false);
  const attempt = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function pay() {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError("");
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("Please sign in again before paying.");
      attempt.current ??= crypto.randomUUID();
      const response = await fetch("/api/flutterwave/initialize", {
        method: "POST", headers: { Authorization: `Bearer ${data.session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: attempt.current, expected_minor: Math.round(total * 100), address: { ...address, delivery_method: "standard" } }),
      });
      const result = await response.json();
      if (!response.ok) {
        // A new attempt after an explicit validation failure; preserve ID on an uncertain network failure.
        if (response.status === 409) attempt.current = null;
        throw new Error(result.message || "Payment could not be started.");
      }
      const target = new URL(result.url);
      if (target.protocol !== "https:" || target.hostname !== "checkout.flutterwave.com") throw new Error("Invalid payment link.");
      window.location.assign(target.href);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Payment could not be started. Please retry.");
      locked.current = false; setBusy(false);
    }
  }
  return <div className="choice-step">
    <div className="checkout-title"><span>Step 3 of 3</span><h3>Pay securely with Flutterwave</h3>
      <p>Your products total is <strong>{new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(total)}</strong>. Choose a payment method on Flutterwave’s secure checkout. Delivery is paid separately to the courier.</p></div>
    <div className="secure-note"><ShieldCheck/> Your order is confirmed only after payment is verified. Taiga does not collect or store your card details.</div>
    {error && <p className="checkout-error" role="alert">{error}</p>}
    <div className="step-actions"><button type="button" disabled={busy} onClick={onBack}>Back</button>
      <button type="button" disabled={busy} onClick={()=>void pay()}>{busy ? "Opening secure checkout…" : "Pay with Flutterwave"}</button></div>
  </div>;
}
