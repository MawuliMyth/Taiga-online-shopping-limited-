"use client";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { 
  Check, CheckCircle2, CreditCard, Heart, Minus, Package, Plus, 
  ShieldCheck, ShoppingCart, Trash2, X, Clock, Truck, PackageCheck, 
  ClipboardCheck, ChevronDown, ChevronUp, AlertCircle, UserRound, Mail
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { nigeriaCities, nigeriaStates } from "../data/nigeriaLocations";

type CartRow={product_id:string;quantity:number;products:{name:string;price:number;image_url:string;inventory:number}|null};
const money=(value:number)=>`₦${value.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;

function addressInputRules(key:string){
  if(key==="first_name"||key==="last_name") return {minLength:2,maxLength:50,title:"Enter a valid name using letters, spaces, apostrophes or hyphens.",autoComplete:key==="first_name"?"given-name":"family-name"};
  if(key==="phone"||key==="additional_phone") return {type:"tel",inputMode:"tel" as const,minLength:11,maxLength:14,pattern:"(?:\\+234|0)(?:7[0-9]|8[0-9]|9[0-1])[0-9]{8}",title:"Enter a valid Nigerian phone number, for example 08030000000.",autoComplete:key==="phone"?"tel":"off"};
  if(key==="line1") return {minLength:5,maxLength:160,title:"Enter a complete street address.",autoComplete:"street-address"};
  if(key==="additional_info") return {maxLength:200,title:"Additional delivery information must be 200 characters or fewer."};
  return {minLength:2,maxLength:80};
}

declare global { interface Window { PaystackPop?:new()=>{resumeTransaction:(accessCode:string)=>void} } }

export function StorePanels({kind,user,onClose,onChanged}:{kind:"cart"|"wishlist"|"orders"|"account"|"inbox";user:User;onClose:()=>void;onChanged:()=>void}){
  const [rows,setRows]=useState<any[]>([]),[loading,setLoading]=useState(true),[checkout,setCheckout]=useState(false),[step,setStep]=useState(1),[done,setDone]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[addressError,setAddressError]=useState("");
  const [address,setAddress]=useState({first_name:"",last_name:"",phone:"",additional_phone:"",line1:"",additional_info:"",state:"",city:""});
  const [delivery,setDelivery]=useState<""|"standard"|"pickup">("");
  const [deliverySettings,setDeliverySettings]=useState({free_shipping_threshold:50000,standard_shipping_fee:2500,pickup_shipping_fee:1500});
  
  // Track expanded order row for detailed timeline
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  function validateAddress(){
    const namePattern=/^[A-Za-zÀ-ÖØ-öø-ÿ]+(?:[ '\-][A-Za-zÀ-ÖØ-öø-ÿ]+)*$/u;
    const phonePattern=/^(?:\+234|0)(?:7[0-9]|8[0-9]|9[0-1])[0-9]{8}$/;
    if(!namePattern.test(address.first_name.trim())){setAddressError("First name must contain letters only. Spaces, apostrophes and hyphens are allowed.");return false}
    if(!namePattern.test(address.last_name.trim())){setAddressError("Last name must contain letters only. Spaces, apostrophes and hyphens are allowed.");return false}
    if(!phonePattern.test(address.phone.replace(/[\s()-]/g,""))){setAddressError("Enter a valid Nigerian phone number, for example 08030000000.");return false}
    if(address.additional_phone&&!phonePattern.test(address.additional_phone.replace(/[\s()-]/g,""))){setAddressError("Enter a valid additional Nigerian phone number or leave it empty.");return false}
    if(address.line1.trim().length<5){setAddressError("Enter a complete street address of at least 5 characters.");return false}
    if(!address.state||!address.city){setAddressError("Select both a state and city.");return false}
    setAddressError("");return true;
  }

  async function load(){
    setLoading(true);
    const settingsResult=await supabase.from("store_settings").select("free_shipping_threshold,standard_shipping_fee,pickup_shipping_fee").eq("id",1).maybeSingle();
    if(settingsResult.data)setDeliverySettings(settingsResult.data);
    if(kind==="account"){
      const {data}=await supabase.from("profiles").select("full_name,email,created_at").eq("id",user.id).maybeSingle();
      setRows([{...(data??{}),email:data?.email||user.email,full_name:data?.full_name||user.user_metadata?.full_name||"Taiga customer"}]);
    }else if(kind==="inbox"){
      const {data}=await supabase.from("orders").select("id,order_number,status,created_at,total").eq("user_id",user.id).order("created_at",{ascending:false});
      setRows(data??[]);
    }else if(kind==="cart"){
      const {data,error:loadError}=await supabase.from("cart_items").select("product_id,quantity,products(name,price,image_url,inventory)").eq("user_id",user.id);
      if(loadError)setError(loadError.message);
      setRows(data??[]);
    }else if(kind==="wishlist"){
      const {data}=await supabase.from("wishlist_items").select("product_id,products(name,price,image_url,inventory)").eq("user_id",user.id);
      setRows(data??[]);
    }else{
      const {data}=await supabase.from("orders").select("id,order_number,total,status,created_at,shipping_address,order_items(product_name,quantity)").eq("user_id",user.id).order("created_at",{ascending:false});
      setRows(data??[]);
    }
    setLoading(false);
  }

  useEffect(()=>{load()},[kind]);

  async function quantity(row:CartRow,next:number){
    if(next<1) await supabase.from("cart_items").delete().eq("user_id",user.id).eq("product_id",row.product_id);
    else await supabase.from("cart_items").update({quantity:Math.min(next,row.products?.inventory??next)}).eq("user_id",user.id).eq("product_id",row.product_id);
    await load();
    onChanged();
  }

  async function remove(id:string){
    await supabase.from(kind==="cart"?"cart_items":"wishlist_items").delete().eq("user_id",user.id).eq("product_id",id);
    await load();
    onChanged();
  }

  async function moveToCart(row:any){
    await supabase.from("cart_items").upsert({user_id:user.id,product_id:row.product_id,quantity:1});
    await supabase.from("wishlist_items").delete().eq("user_id",user.id).eq("product_id",row.product_id);
    await load();
    onChanged();
  }

  function loadPaystack(){
    return new Promise<void>((resolve,reject)=>{
      if(window.PaystackPop) return resolve();
      const existing=document.querySelector<HTMLScriptElement>('script[data-paystack]');
      if(existing){
        if(existing.dataset.loaded==="true") return resolve();
        existing.addEventListener("load",()=>resolve(),{once:true});
        existing.addEventListener("error",()=>reject(new Error("Paystack could not be loaded")),{once:true});
        return;
      }
      const script=document.createElement("script");
      script.src="https://js.paystack.co/v2/inline.js";
      script.dataset.paystack="true";
      script.onload=()=>{
        script.dataset.loaded="true";
        resolve();
      };
      script.onerror=()=>reject(new Error("Paystack could not be loaded"));
      document.head.appendChild(script);
    });
  }

  async function payWithPaystack(){
    setError("");
    if(!delivery){
      setStep(2);
      setError("Select a delivery method before payment.");
      return;
    }
    setBusy(true);
    try{
      await loadPaystack();
      if(!window.PaystackPop) throw new Error("Paystack checkout did not initialize. Please refresh and try again.");
      const {data:{session}}=await supabase.auth.getSession();
      if(!session)throw new Error("Your session expired. Please sign in again.");
      const initialization=await fetch("/api/paystack/initialize",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({delivery_method:delivery})});
      const initialized=await initialization.json().catch(()=>null);
      if(!initialization.ok||!initialized?.ok)throw new Error(initialized?.message||"Paystack could not be initialized.");
      setBusy(false);
      const popup=new window.PaystackPop();
      popup.resumeTransaction(initialized.access_code);
      const poll=window.setInterval(async()=>{const response=await fetch("/api/paystack/verify",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({reference:initialized.reference,address:{...address,country:"Nigeria",delivery_method:delivery,payment_method:"paystack",payment_reference:initialized.reference}})});if(response.ok){window.clearInterval(poll);const result=await response.json();setDone(result.order.order_number);setCheckout(false);await load();onChanged()}},2500);
      window.setTimeout(()=>window.clearInterval(poll),10*60*1000);
    }catch(loadError:any){
      setBusy(false);
      setError(loadError?.message||"Paystack could not be loaded.");
    }
  }

  const subtotal=rows.reduce((sum,row)=>sum+Number(row.products?.price??0)*(row.quantity??1),0),
        shipping=delivery?(delivery==="pickup"?Number(deliverySettings.pickup_shipping_fee):subtotal>=Number(deliverySettings.free_shipping_threshold)?0:Number(deliverySettings.standard_shipping_fee)):null,
        total=subtotal+(shipping??0);

  // Free delivery threshold calculations
  const freeThreshold = Number(deliverySettings.free_shipping_threshold);
  const isFreeUnlocked = subtotal >= freeThreshold;
  const progressPercent = Math.min(100, (subtotal / freeThreshold) * 100);

  return <div className="panel-overlay" onMouseDown={event=>event.target===event.currentTarget&&onClose()}><aside className={`store-panel ${kind === "cart" ? "cart-panel" : ""} ${checkout ? "checkout-wide" : ""}`} style={{ display: "flex", flexDirection: "column" }}><header><div>{kind==="cart"?<ShoppingCart/>:kind==="wishlist"?<Heart/>:kind==="account"?<UserRound/>:kind==="inbox"?<Mail/>:<Package/>}<h2>{kind==="cart"?`Your Cart (${rows.length})`:kind==="wishlist"?"Saved items":kind==="account"?"My account":kind==="inbox"?"Inbox":"Your orders"}</h2></div><button onClick={onClose} aria-label="Close"><X/></button></header>
  {loading?<div className="panel-shimmer" aria-label="Loading"><span/><span/><span/></div>:kind==="account"?<div className="account-panel-content"><div className="account-avatar">{String(rows[0]?.full_name||rows[0]?.email||"T").charAt(0).toUpperCase()}</div><span>Taiga customer</span><h3>{rows[0]?.full_name}</h3><p>{rows[0]?.email}</p><dl><div><dt>Account status</dt><dd>Active</dd></div><div><dt>Member since</dt><dd>{rows[0]?.created_at?new Date(rows[0].created_at).toLocaleDateString(undefined,{year:"numeric",month:"long",day:"numeric"}):"Recently joined"}</dd></div></dl><p>Your profile is connected to your secure Taiga sign-in.</p></div>:kind==="inbox"?<div className="inbox-list">{rows.length?rows.map(row=><article key={row.id}><span><PackageCheck/></span><div><strong>Order {row.order_number} is {String(row.status).replaceAll("_"," ")}</strong><p>Your order total is {money(Number(row.total))}. Open Orders for full tracking details.</p><small>{new Date(row.created_at).toLocaleString()}</small></div></article>):<div className="panel-empty"><Mail/><h3>Your inbox is clear</h3><p>Updates about your orders will appear here automatically.</p></div>}</div>:done?<div className="success-state"><div className="success-icon"><CheckCircle2/></div><span>Order confirmed</span><h3>Thank you for your order</h3><p>Your payment was confirmed and your order is being prepared.</p><div className="success-reference"><small>Order reference</small><strong>{done}</strong></div><button onClick={onClose}>Continue shopping</button></div>:rows.length===0?<div className="panel-empty"><ShoppingCart/><h3>Your {kind==="cart"?"cart":kind==="wishlist"?"wishlist":"order history"} is empty</h3><p>Explore the store and discover something you’ll love.</p><button onClick={onClose}>Browse products</button></div>:<div className="panel-list">
    
    {kind==="orders" ? rows.map(row=>{
      const isExpanded = expandedOrder === row.id;
      return (
        <article className="order-row" key={row.id} style={{ display: "flex", flexDirection: "column", gap: "0", alignItems: "stretch", padding: "0", overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", cursor: "pointer" }} onClick={() => setExpandedOrder(isExpanded ? null : row.id)}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <strong style={{ fontSize: "14px" }}>{row.order_number}</strong>
                {isExpanded ? <ChevronUp size={14} style={{ color: "var(--muted)" }} /> : <ChevronDown size={14} style={{ color: "var(--muted)" }} />}
              </div>
              <span style={{ fontSize: "11px", color: "var(--muted)" }}>{new Date(row.created_at).toLocaleDateString()}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
              <b style={{ fontSize: "14px" }}>{money(Number(row.total))}</b>
              <span className={`status ${row.status}`}>{row.status}</span>
            </div>
          </div>
          
          <div style={{ padding: "0 16px 16px 16px", borderTop: "1px solid var(--border)" }}>
            <small style={{ display: "block", color: "var(--muted)", margin: "6px 0" }}>
              {row.order_items?.map((item:any)=>`${item.product_name} × ${item.quantity}`).join(", ")}
            </small>
          </div>

          {/* Collapsible shipping tracking timeline */}
          {isExpanded && (
            <div style={{ background: "var(--secondary)", borderTop: "1px solid var(--border)", padding: "16px", display: "flex", flexDirection: "column", gap: "16px" }} className="animate-scale-up">
              <h4 style={{ fontSize: "10px", textTransform: "uppercase", fontWeight: "800", letterSpacing: "0.08em", color: "var(--muted)" }}>Fulfillment Timeline</h4>
              
              {row.status === "cancelled" ? (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "var(--danger-light)", color: "var(--danger)", padding: "10px", borderRadius: "var(--radius-md)", fontSize: "12px", fontWeight: "600" }}>
                  <AlertCircle size={16} />
                  <span>This order has been cancelled and refunded.</span>
                </div>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", position: "relative", paddingBottom: "10px", marginTop: "8px" }}>
                  <div style={{ position: "absolute", top: "11px", left: "15px", right: "15px", height: "2px", background: "var(--border)", zIndex: 1 }} />
                  <div 
                    style={{ 
                      position: "absolute", 
                      top: "11px", 
                      left: "15px", 
                      height: "2px", 
                      background: "var(--primary)", 
                      zIndex: 2, 
                      transition: "width 0.4s ease",
                      width: 
                        row.status === "pending" ? "0%" :
                        row.status === "paid" ? "25%" :
                        row.status === "processing" ? "50%" :
                        row.status === "shipped" ? "75%" :
                        "100%"
                    }} 
                  />
                  
                  {[
                    { state: "pending", label: "Ordered", icon: ClipboardCheck },
                    { state: "paid", label: "Paid", icon: CreditCard },
                    { state: "processing", label: "Packing", icon: Clock },
                    { state: "shipped", label: "Transit", icon: Truck },
                    { state: "delivered", label: "Delivered", icon: PackageCheck }
                  ].map((step) => {
                    const Icon = step.icon;
                    const orderStatuses = ["pending", "paid", "processing", "shipped", "delivered"];
                    const currentIdx = orderStatuses.indexOf(row.status);
                    const stepIdx = orderStatuses.indexOf(step.state);
                    const isCompleted = stepIdx <= currentIdx;
                    const isCurrent = stepIdx === currentIdx;

                    return (
                      <div key={step.state} style={{ display: "flex", flexDirection: "column", alignItems: "center", zIndex: 3, width: "50px" }}>
                        <div 
                          style={{ 
                            width: "22px", 
                            height: "22px", 
                            borderRadius: "50%", 
                            background: isCompleted ? "var(--primary)" : "var(--card-bg)", 
                            color: isCompleted ? "#ffffff" : "var(--muted-light)",
                            border: `1.5px solid ${isCompleted ? "var(--primary)" : "var(--border)"}`,
                            display: "grid", 
                            placeItems: "center",
                            boxShadow: isCurrent ? "0 0 0 3px rgba(13, 122, 95, 0.2)" : "none"
                          }}
                        >
                          <Icon size={10} />
                        </div>
                        <span style={{ fontSize: "9px", fontWeight: isCurrent ? "800" : "600", color: isCurrent ? "var(--foreground)" : "var(--muted)", marginTop: "4px", textAlign: "center" }}>
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              
              <div style={{ fontSize: "11px", color: "var(--muted)", borderTop: "1px solid var(--border)", paddingTop: "8px" }}>
                <span>Delivery: <strong>{row.shipping_address?.first_name} {row.shipping_address?.last_name}</strong></span>
                <span style={{ display: "block", marginTop: "2px" }}>{row.shipping_address?.line1}, {row.shipping_address?.city}, {row.shipping_address?.state}</span>
              </div>
            </div>
          )}
        </article>
      );
    }) : rows.map(row=><article className="cart-row" key={row.product_id}><img src={row.products?.image_url} alt={row.products?.name||"Cart product"}/><div><h3>{row.products?.name}</h3><span className="cart-variant">Available now · Ships from Taiga</span><strong>{money(Number(row.products?.price))}</strong><small className="stock-note">{row.products?.inventory} units available</small>{kind==="cart"?<div className="qty"><button onClick={()=>quantity(row,row.quantity-1)} aria-label="Decrease quantity"><Minus/></button><span>{row.quantity}</span><button onClick={()=>quantity(row,row.quantity+1)} aria-label="Increase quantity"><Plus/></button></div>:<button className="move-cart" onClick={()=>moveToCart(row)}>Add to cart</button>}</div><button className="remove-row" onClick={()=>remove(row.product_id)} aria-label={`Remove ${row.products?.name||"product"}`}><Trash2/><span>Remove</span></button></article>)}
  </div>}
  {kind==="cart"&&rows.length>0&&!done&&<footer>
    {/* Free Shipping Progress Indicator */}
    <div className="free-delivery-progress" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "16px", marginBottom: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
        <span style={{ fontWeight: 700, fontSize: "12px", color: isFreeUnlocked ? "var(--success)" : "var(--muted)" }}>
          {isFreeUnlocked ? "🎉 Free Delivery Unlocked!" : `Add ${money(freeThreshold - subtotal)} more for Free Standard Delivery`}
        </span>
        <span style={{ fontSize: "12px", fontWeight: "750", color: "var(--foreground)" }}>
          {Math.round(progressPercent)}%
        </span>
      </div>
      <div className="free-delivery-bar-bg">
        <div className="free-delivery-bar-fill" style={{ width: `${progressPercent}%`, backgroundColor: isFreeUnlocked ? "var(--success)" : "var(--primary)" }} />
      </div>
    </div>
    
    <h4>Order summary</h4>
    <div><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
    <div><span>Delivery</span><strong>{shipping===null?"Calculated at checkout":shipping===0?"FREE":money(shipping)}</strong></div>
    <button onClick={()=>{setCheckout(true);setStep(1);setDelivery("");setError("")}}>Go to checkout</button>
  </footer>}
  {checkout&&<div className="checkout-screen"><div className="checkout-main"><button className="back-checkout" onClick={()=>setCheckout(false)}>← Back to cart</button><div className="checkout-steps">{["Customer address","Delivery details","Payment method"].map((label,index)=><button className={step===index+1?"active":step>index+1?"complete":""} onClick={()=>step>index+1&&setStep(index+1)} key={label}><span>{step>index+1?<Check/>:index+1}</span>{label}</button>)}</div>
  {step===1&&<form className="address-form validated-form" noValidate onSubmit={event=>{event.preventDefault();if(!validateAddress())return;setAddress(current=>Object.fromEntries(Object.entries(current).map(([key,value])=>[key,value.trim()])) as typeof current);setStep(2)}}><div className="checkout-title"><span>Step 1 of 3</span><h3>Where should we deliver?</h3><p>Enter the recipient’s Nigerian delivery address.</p></div><div className="form-grid">{Object.entries(address).map(([key,value])=>key==="state"?<label key={key}>State<select value={value} onChange={event=>{setAddressError("");setAddress({...address,state:event.target.value,city:""})}} required><option value="">Select a state</option>{nigeriaStates.map(state=><option key={state} value={state}>{state}</option>)}</select></label>:key==="city"?<label key={key}>City<select value={value} onChange={event=>{setAddressError("");setAddress({...address,city:event.target.value})}} disabled={!address.state} required><option value="">{address.state?"Select a city":"Select a state first"}</option>{(nigeriaCities[address.state]??[]).map(city=><option key={city} value={city}>{city}</option>)}</select></label>:<label key={key}>{key==="line1"?"Street address":key.replaceAll("_"," ")}<input {...addressInputRules(key)} value={value} onChange={event=>{setAddressError("");setAddress({...address,[key]:event.target.value})}} required={!['additional_phone','additional_info'].includes(key)} placeholder={key==="phone"?"e.g. 08030000000":""}/></label>)}</div>{addressError&&<div className="form-error" role="alert"><AlertCircle/>{addressError}</div>}<div className="step-actions"><button type="button" onClick={()=>setCheckout(false)}>Cancel</button><button>Save & continue</button></div></form>}
  {step===2&&<div className="choice-step delivery-choice"><div className="checkout-title"><span>Step 2 of 3</span><h3>How would you like to receive your order?</h3><p>Choose one option. Delivery charges are only applied after your selection.</p></div><label className={delivery==="standard"?"selected":""}><input type="radio" name="delivery" checked={delivery==="standard"} onChange={()=>setDelivery("standard")}/><span className="delivery-radio" aria-hidden="true"/><div><strong>Standard delivery</strong><span>Doorstep delivery in 2–5 business days</span><small>Tracked nationwide delivery to your saved address</small></div><b>{subtotal>=50000?"FREE":money(2500)}</b></label><label className={delivery==="pickup"?"selected":""}><input type="radio" name="delivery" checked={delivery==="pickup"} onChange={()=>setDelivery("pickup")}/><span className="delivery-radio" aria-hidden="true"/><div><strong>Pick-up station</strong><span>Collect from a Taiga collection point</span><small>We will notify you when your order is ready</small></div><b>{money(1500)}</b></label>{!delivery&&<p className="delivery-hint">Select an option to see your final order total.</p>}<div className="step-actions"><button onClick={()=>setStep(1)}>Back</button><button onClick={()=>setStep(3)} disabled={!delivery}>Continue</button></div></div>}
  {step===3&&<div className="choice-step"><div className="checkout-title"><span>Step 3 of 3</span><h3>Pay securely with Paystack</h3><p>Choose card, bank transfer, bank account or USSD in the secure Paystack window.</p></div><div className="paystack-option selected"><span className="paystack-mark">paystack</span><div><strong>Paystack secure checkout</strong><small>Your payment information is processed securely by Paystack.</small></div><CreditCard/></div><div className="secure-note"><ShieldCheck/> Your order is created only after Paystack confirms the payment.</div>{error&&<div className="checkout-error">{error}</div>}<div className="step-actions"><button onClick={()=>setStep(2)}>Back</button><button onClick={payWithPaystack} disabled={busy}>{busy?"Connecting to Paystack…":`Pay ${money(total)}`}</button></div></div>}</div><aside className="checkout-summary"><h3>Order summary</h3><div><span>Items total ({rows.reduce((sum,row)=>sum+(row.quantity??1),0)})</span><b>{money(subtotal)}</b></div><div><span>Delivery</span><b>{shipping===null?"Select a method":shipping===0?"FREE":money(shipping)}</b></div><div className="summary-total"><span>Total</span><strong>{money(total)}</strong></div><p>All prices and payments are in Nigerian naira.</p></aside></div>}
  </aside></div>
}
