"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
type Checkout = {reference:string;customer_email:string;amount_minor:number;status:string;created_at:string;review_reason:string|null};
type Receipt = {transaction_id:string;reference:string;reason:string|null};
export function FlutterwavePayments() {
  const [rows,setRows]=useState<Checkout[]>([]),[reviews,setReviews]=useState<Receipt[]>([]);
  const [message,setMessage]=useState(""),[busy,setBusy]=useState<string|null>(null);
  const load=useCallback(async()=>{
    const [checkouts,receipts]=await Promise.all([
      supabase.from("flutterwave_checkouts").select("reference,customer_email,amount_minor,status,created_at,review_reason").order("created_at",{ascending:false}).limit(50),
      supabase.from("flutterwave_receipts").select("transaction_id,reference,reason").eq("outcome","review").order("verified_at",{ascending:false}).limit(50),
    ]);
    if(checkouts.error||receipts.error){setMessage("Flutterwave payment records are not available yet. Complete the database setup before enabling payments.");return;}
    setRows(checkouts.data??[]);setReviews(receipts.data??[]);
  },[]);
  useEffect(()=>{void load()},[load]);
  async function recheck(reference:string){
    if(busy)return;setBusy(reference);setMessage("");
    try{
      const {data}=await supabase.auth.getSession();
      if(!data.session)throw new Error("Sign in again to check payments.");
      const response=await fetch("/api/flutterwave/verify",{method:"POST",headers:{Authorization:`Bearer ${data.session.access_token}`,"Content-Type":"application/json"},body:JSON.stringify({reference})});
      const result=await response.json();
      if(!response.ok)throw new Error(result.message||"Verification unavailable.");
      setMessage(result.status==="paid"?"Payment verified. Reopen Orders to see the confirmed order.":"Payment needs manual review. Do not charge the customer again.");
      await load();
    }catch(cause){setMessage(cause instanceof Error?cause.message:"Verification unavailable.")}
    finally{setBusy(null)}
  }
  return <section style={{padding:24,marginTop:24,background:"var(--surface, white)",borderRadius:16}}>
    <h2>Flutterwave payments</h2><p>Latest 50 checkout attempts. “Pending” does not confirm payment. Recheck queries Flutterwave; it does not charge the customer.</p>
    <button type="button" disabled={!!busy} onClick={()=>void load()}>Refresh payments</button>
    {message&&<p role="status">{message}</p>}
    {reviews.length>0&&<div role="note"><h3>Payments requiring review</h3><p>Review these in Flutterwave and contact the customer. Refunds are not automatic.</p>
      {reviews.map(receipt=><p key={receipt.transaction_id} style={{overflowWrap:"anywhere"}}><strong>Transaction {receipt.transaction_id}</strong> · {receipt.reference}<br/>{receipt.reason}</p>)}
    </div>}
    {rows.length===0&&!message?<p>No Flutterwave checkout attempts yet.</p>:<div style={{overflowX:"auto"}}><table style={{width:"100%",textAlign:"left"}}><thead><tr><th>Reference / customer</th><th>Products total</th><th>Status</th><th>Action</th></tr></thead><tbody>
      {rows.map(row=><tr key={row.reference}><td style={{padding:"16px 8px",overflowWrap:"anywhere",maxWidth:300}}>{row.reference}<br/>{row.customer_email}</td><td>{new Intl.NumberFormat("en-NG",{style:"currency",currency:"NGN"}).format(row.amount_minor/100)}</td><td>{row.status}</td><td><button type="button" disabled={!!busy} onClick={()=>void recheck(row.reference)}>{busy===row.reference?"Checking…":"Recheck payment"}</button></td></tr>)}
    </tbody></table></div>}
  </section>;
}
