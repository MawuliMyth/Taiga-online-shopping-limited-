"use client";
/* eslint-disable @next/next/no-img-element -- Cart and order media uses runtime catalogue URLs. */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { 
  Check, CreditCard, Heart, Minus, Package, Plus, 
  ShieldCheck, ShoppingCart, Trash2, X, Clock, Truck, PackageCheck, 
  ClipboardCheck, ChevronDown, ChevronUp, AlertCircle, UserRound, Mail, MessageCircle, Copy
} from "lucide-react";
import { readDeliveryAddress } from "../../lib/account-rules";
import { supabase } from "../../lib/supabase";
import { nigeriaCities, nigeriaStates } from "../data/nigeriaLocations";

type CartRow={product_id:string;variant_key:string;selected_variant:any;quantity:number;products:{name:string;slug:string;price:number;image_url:string;inventory:number;variants:any[]}|null};
const whatsappNumber=(phone:string)=>{const digits=String(phone||"").replace(/\D/g,"");return digits.startsWith("0")?`234${digits.slice(1)}`:digits};
const money=(value:number)=>`₦${value.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const BANK_ACCOUNTS=[
  {id:"access",bank:"Access Bank",accountNumber:"1971465449",accountName:"Taiga Online Shopping Limited",logo:"/banks/access-bank-optimized.jpg"},
  {id:"fcmb",bank:"FCMB",accountNumber:"2008277528",accountName:"Taiga Online Shopping Limited",logo:"/banks/fcmb-optimized.jpg"},
  {id:"moniepoint",bank:"Moniepoint MFB",accountNumber:"6677085031",accountName:"Taiga Online Shopping Limited",logo:"/banks/moniepoint-mfb-optimized.jpg"},
] as const;

function addressInputRules(key:string){
  if(key==="first_name"||key==="last_name") return {minLength:2,maxLength:50,title:"Enter a valid name using letters, spaces, apostrophes or hyphens.",autoComplete:key==="first_name"?"given-name":"family-name"};
  if(key==="phone"||key==="additional_phone") return {type:"tel",inputMode:"tel" as const,minLength:11,maxLength:14,pattern:"(?:\\+234|0)(?:7[0-9]|8[0-9]|9[0-1])[0-9]{8}",title:"Enter a valid Nigerian phone number, for example 08030000000.",autoComplete:key==="phone"?"tel":"off"};
  if(key==="line1") return {minLength:5,maxLength:160,title:"Enter a complete street address.",autoComplete:"street-address"};
  if(key==="additional_info") return {maxLength:200,title:"Additional delivery information must be 200 characters or fewer."};
  return {minLength:2,maxLength:80};
}

export function StorePanels({kind,user,onClose,onChanged}:{kind:"cart"|"wishlist";user:User;onClose:()=>void;onChanged:()=>void}){
  const router=useRouter();
  const mutationLock=useRef(false);
  const [updating,setUpdating]=useState(false);
  const [rows,setRows]=useState<any[]>([]),[loading,setLoading]=useState(true),[checkout,setCheckout]=useState(false),[step,setStep]=useState(1),[error,setError]=useState(""),[addressError,setAddressError]=useState("");
  const [supportPhone,setSupportPhone]=useState("");
  const [address,setAddress]=useState(()=>readDeliveryAddress(user.user_metadata?.delivery_address));
  const [delivery,setDelivery]=useState<""|"standard">("");
  const [deliveryQuote,setDeliveryQuote]=useState<{amount:number;reference:string;expiresAt:number;weight:number;minDays:number;maxDays:number}|null>(null);
  const [quoting,setQuoting]=useState(false);
  const quoteRequest=useRef(0);
  const [selectedBank,setSelectedBank]=useState<(typeof BANK_ACCOUNTS)[number]["id"]>("access");
  const [copiedAccount,setCopiedAccount]=useState("");
  
  const cartItemCount=kind==="cart"?rows.reduce((sum,row)=>sum+Number(row.quantity||0),0):0;

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

  const load=useCallback(async()=>{
    setLoading(true);
    setError("");
    const settingsResult=await supabase.from("store_settings").select("standard_shipping_fee,support_phone").eq("id",1).maybeSingle();
    if(settingsResult.data){setSupportPhone(settingsResult.data.support_phone||"")}
    if(kind==="cart"){
      const {data,error:loadError}=await supabase.from("cart_items").select("product_id,variant_key,selected_variant,quantity,products(name,slug,price,image_url,inventory,variants)").eq("user_id",user.id);
      if(loadError)setError(loadError.message);
      setRows(data??[]);
    }else if(kind==="wishlist"){
      const {data}=await supabase.from("wishlist_items").select("product_id,products(name,slug,price,image_url,inventory,variants)").eq("user_id",user.id);
      setRows(data??[]);
    }
    setLoading(false);
  },[kind,user.email,user.id,user.user_metadata?.full_name]);

  useEffect(()=>{void load()},[load]);

  useEffect(()=>{
    quoteRequest.current++;setDeliveryQuote(null);setDelivery("");setQuoting(false);setStep(current=>current===3?2:current);
  },[address,rows]);

  useEffect(()=>{
    if(!deliveryQuote)return;
    const timer=window.setTimeout(()=>{setDeliveryQuote(null);setDelivery("");setStep(current=>current===3?2:current);setError("Your delivery quote expired. Please request a fresh quote before paying.")},Math.max(0,deliveryQuote.expiresAt-Date.now()));
    return ()=>window.clearTimeout(timer);
  },[deliveryQuote]);

  async function requestDeliveryQuote(){
    const id=++quoteRequest.current;
    setQuoting(true);setError("");setDeliveryQuote(null);setDelivery("");
    try{
      const {data}=await supabase.auth.getSession();
      if(!data.session)throw new Error("Please sign in again to calculate delivery.");
      const response=await fetch("/api/shipping/quote",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${data.session.access_token}`},body:JSON.stringify({address}),signal:AbortSignal.timeout(40000)});
      const result=await response.json();
      if(!response.ok||!result.ok)throw new Error(result.message||"Contact Taiga for a delivery quote before paying.");
      if(!Number.isFinite(result.amount)||result.amount<0||!Number.isFinite(result.expiresAt)||result.expiresAt<=Date.now())throw new Error("Please request a fresh delivery quote.");
      if(id===quoteRequest.current)setDeliveryQuote(result);
    }catch(error){if(id===quoteRequest.current)setError(error instanceof Error?error.message:"Delivery quotes are unavailable. Please contact Taiga.")}
    finally{if(id===quoteRequest.current)setQuoting(false)}
  }

  async function quantity(row:CartRow,next:number){
    if(mutationLock.current)return;
    mutationLock.current=true;setUpdating(true);
    try{
    const variantStock=Array.isArray(row.products?.variants)?row.products?.variants.find((variant:any)=>variant.id===row.variant_key)?.inventory:null;
    const result=next<1?await supabase.from("cart_items").delete().eq("user_id",user.id).eq("product_id",row.product_id).eq("variant_key",row.variant_key||"default"):await supabase.from("cart_items").update({quantity:Math.min(next,99,Number(variantStock??row.products?.inventory??next))}).eq("user_id",user.id).eq("product_id",row.product_id).eq("variant_key",row.variant_key||"default");
    if(result.error){setError("Cart quantity could not be updated. Please try again.");return}
    setError("");
    setRows(current=>next<1?current.filter(item=>!(item.product_id===row.product_id&&item.variant_key===row.variant_key)):current.map(item=>item.product_id===row.product_id&&item.variant_key===row.variant_key?{...item,quantity:Math.min(next,99,Number(variantStock??row.products?.inventory??next))}:item));
    onChanged();
    }catch{setError("Cart quantity could not be updated. Please try again.")}
    finally{mutationLock.current=false;setUpdating(false)}
  }

  async function remove(id:string,variantKey="default"){
    let query=supabase.from(kind==="cart"?"cart_items":"wishlist_items").delete().eq("user_id",user.id).eq("product_id",id);
    if(kind==="cart")query=query.eq("variant_key",variantKey);
    const {error:removeError}=await query;
    if(removeError){setError("This item could not be removed. Please try again.");return}
    setError("");
    setRows(current=>current.filter(row=>!(row.product_id===id&&(kind!=="cart"||row.variant_key===variantKey))));
    onChanged();
  }

  async function moveToCart(row:any){
    if(Array.isArray(row.products?.variants)&&row.products.variants.length){router.push(`/product/${row.products.slug}`);return}
    if(Number(row.products?.inventory??0)<1){setError("This product is currently out of stock.");return}
    const {error:cartError}=await supabase.from("cart_items").upsert({user_id:user.id,product_id:row.product_id,quantity:1});
    if(cartError){setError("This product could not be added to your cart.");return}
    const {error:wishlistError}=await supabase.from("wishlist_items").delete().eq("user_id",user.id).eq("product_id",row.product_id);
    if(wishlistError){setError("The product was added to your cart, but could not be removed from saved items.");await load();onChanged();return}
    setError("");
    await load();
    onChanged();
  }

  const subtotal=rows.reduce((sum,row)=>sum+Number(row.selected_variant?.price??(Array.isArray(row.products?.variants)?row.products.variants.find((variant:any)=>variant.id===row.variant_key)?.price:null)??row.products?.price??0)*(row.quantity??1),0),
        shipping=deliveryQuote?.amount??null,
        total=subtotal+(shipping??0);

  async function copyAccountNumber(accountNumber:string){
    await navigator.clipboard.writeText(accountNumber);
    setCopiedAccount(accountNumber);
    window.setTimeout(()=>setCopiedAccount(current=>current===accountNumber?"":current),1800);
  }

  function bankTransferWhatsappUrl(){
    const account=BANK_ACCOUNTS.find(item=>item.id===selectedBank)??BANK_ACCOUNTS[0];
    const itemLines=rows.map(row=>`• ${row.products?.name||"Product"}${row.selected_variant?.label?` (${row.selected_variant.label})`:""} × ${row.quantity??1}`).join("\n");
    const message=[
      "Hello Taiga, I have made a bank transfer for this order.",
      "",
      itemLines,
      `Total transferred: ${money(total)}`,
      `Taiga delivery: ${shipping===null?"Quote required":money(shipping)} (delivered by Taiga)`,
      `Delivery quote reference: ${deliveryQuote?.reference||"Not available"}`,
      `Bank paid into: ${account.bank} · ${account.accountNumber}`,
      `Customer: ${address.first_name} ${address.last_name}`,
      `Phone: ${address.phone}`,
      `Delivery address: ${address.line1}, ${address.city}, ${address.state}`,
      "",
      "I will attach my transfer receipt here. Please verify the payment and confirm my order.",
    ].filter(Boolean).join("\n");
    return `https://wa.me/${whatsappNumber(supportPhone)}?text=${encodeURIComponent(message)}`;
  }

  return <div className="panel-overlay" onMouseDown={event=>event.target===event.currentTarget&&onClose()}><aside role="dialog" aria-modal="true" aria-label={kind==="cart"?"Shopping cart":kind} className={`store-panel ${kind === "cart" ? "cart-panel" : ""} ${checkout ? "checkout-wide" : ""}`} style={{ display: "flex", flexDirection: "column" }}><header><div>{kind==="cart"?<ShoppingCart/>:<Heart/>}<h2>{kind==="cart"?`Your Cart${cartItemCount>0?` (${cartItemCount})`:""}`:"Saved items"}</h2></div><button onClick={onClose} aria-label="Close"><X/></button></header>
  {loading?<div className="panel-shimmer" aria-label="Loading"><span/><span/><span/></div>:rows.length===0?<div className="panel-empty"><ShoppingCart/><h3>Your {kind==="cart"?"cart":kind==="wishlist"?"wishlist":"order history"} is empty</h3><p>Explore the store and discover something you’ll love.</p><button onClick={onClose}>Browse products</button></div>:<div className="panel-list">
    
    {rows.map(row=>{const variant=Array.isArray(row.products?.variants)?row.products.variants.find((item:any)=>item.id===row.variant_key):null,stock=Number(variant?.inventory??row.products?.inventory??0),price=Number(row.selected_variant?.price??variant?.price??row.products?.price??0),options=row.selected_variant?.options??variant?.options;return <article className="cart-row" key={`${row.product_id}-${row.variant_key||"default"}`}><img src={row.selected_variant?.image_url||variant?.image_url||row.products?.image_url} alt={row.products?.name||"Cart product"}/><div><h3><a href={`/product/${row.products?.slug}`}>{row.products?.name}</a></h3><span className="cart-variant">{options?Object.entries(options).map(([key,value])=>`${key}: ${value}`).join(" · "):"Standard item"}</span><strong>{money(price)}</strong><small className="stock-note">{stock>0?`${stock} units available`:"Out of stock"}</small>{kind==="cart"?<div className="qty"><button type="button" disabled={updating} onClick={()=>quantity(row,row.quantity-1)} aria-label="Decrease quantity"><Minus/></button><span>{row.quantity}</span><button type="button" disabled={updating||row.quantity>=stock||stock<1} onClick={()=>quantity(row,row.quantity+1)} aria-label="Increase quantity"><Plus/></button></div>:<button className="move-cart" disabled={stock<1} onClick={()=>moveToCart(row)}>{stock<1?"Out of stock":Array.isArray(row.products?.variants)&&row.products.variants.length?"Choose options":"Add to cart"}</button>}</div><button type="button" disabled={updating} className="remove-row" onClick={()=>remove(row.product_id,row.variant_key)} aria-label={`Remove ${row.products?.name||"product"}`}><Trash2/><span>Remove</span></button></article>})}
  </div>}
  {error&&!checkout&&<div className="checkout-error" role="alert">{error}</div>}
  {kind==="cart"&&rows.length>0&&<footer>
    <h4>Order summary</h4>
    <div><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
    <div><span>Delivery</span><strong>{shipping===null?"Calculated at checkout":shipping===0?"FREE":money(shipping)}</strong></div>
    <button type="button" disabled={updating} onClick={()=>{setCheckout(true);setStep(1);setDelivery("standard");setError("")}}>Go to checkout</button>
  </footer>}
  {checkout&&<div className="checkout-screen"><div className="checkout-main"><button className="back-checkout" onClick={()=>setCheckout(false)}>← Back to cart</button><div className="checkout-steps">{["Customer address","Delivery details","Payment method"].map((label,index)=><button className={step===index+1?"active":step>index+1?"complete":""} onClick={()=>step>index+1&&setStep(index+1)} key={label}><span>{step>index+1?<Check/>:index+1}</span>{label}</button>)}</div>
  {step===1&&<form className="address-form validated-form" noValidate onSubmit={event=>{event.preventDefault();if(!validateAddress())return;setAddress(current=>Object.fromEntries(Object.entries(current).map(([key,value])=>[key,value.trim()])) as typeof current);setStep(2)}}><div className="checkout-title"><span>Step 1 of 3</span><h3>Where should we deliver?</h3><p>Enter the recipient’s Nigerian delivery address.</p></div><div className="form-grid">{Object.entries(address).map(([key,value])=>key==="state"?<label key={key}>State<select value={value} onChange={event=>{setAddressError("");setAddress({...address,state:event.target.value,city:""})}} required><option value="">Select a state</option>{nigeriaStates.map(state=><option key={state} value={state}>{state}</option>)}</select></label>:key==="city"?<label key={key}>City<select value={value} onChange={event=>{setAddressError("");setAddress({...address,city:event.target.value})}} disabled={!address.state} required><option value="">{address.state?"Select a city":"Select a state first"}</option>{(nigeriaCities[address.state]??[]).map(city=><option key={city} value={city}>{city}</option>)}</select></label>:<label key={key}>{key==="line1"?"Street address":key.replaceAll("_"," ")}<input {...addressInputRules(key)} value={value} onChange={event=>{setAddressError("");setAddress({...address,[key]:event.target.value})}} required={!['additional_phone','additional_info'].includes(key)} placeholder={key==="phone"?"e.g. 08030000000":""}/></label>)}</div>{addressError&&<div className="form-error" role="alert"><AlertCircle/>{addressError}</div>}<div className="step-actions"><button type="button" onClick={()=>setCheckout(false)}>Cancel</button><button>Save & continue</button></div></form>}
  {step===2&&<div className="choice-step delivery-choice"><div className="checkout-title"><span>Step 2 of 3</span><h3>Taiga delivery</h3><p>Your order is delivered by Taiga, not a third-party courier. Delivery timing is confirmed by our team.</p></div><div className="selected delivery-only-card"><Truck/><div><strong>From Ikeja, Lagos</strong><span>Price based on your destination and packed weight</span><small>{deliveryQuote?`${deliveryQuote.weight} kg · ${deliveryQuote.minDays}–${deliveryQuote.maxDays} business days`:"Rates are set by Taiga. Unlisted destinations require a manual quote."}</small></div><b aria-live="polite">{deliveryQuote?money(deliveryQuote.amount):"Quote required"}</b></div><p>Delivery is calculated by Taiga. No third-party courier service is used.</p><button disabled={quoting} onClick={()=>void requestDeliveryQuote()}>{quoting?"Calculating delivery…":deliveryQuote?"Refresh delivery quote":"Calculate delivery"}</button>{error&&<p role="alert" className="checkout-error">{error}</p>}{supportPhone&&<p><a href={`https://wa.me/${whatsappNumber(supportPhone)}?text=${encodeURIComponent(`Hello Taiga, please confirm a delivery quote to ${address.city}, ${address.state}.`)}`} target="_blank" rel="noreferrer">Contact Taiga for a delivery quote</a></p>}<div className="step-actions"><button onClick={()=>setStep(1)}>Back</button><button disabled={quoting||!deliveryQuote} onClick={()=>{if(!deliveryQuote||deliveryQuote.expiresAt<=Date.now()){setDeliveryQuote(null);setError("Please request a fresh delivery quote.");return}setDelivery("standard");setStep(3)}}>Continue</button></div></div>}
  {step===3&&<div className="choice-step bank-transfer-step"><div className="checkout-title"><span>Step 3 of 3</span><h3>Pay by bank transfer</h3><p>Transfer exactly <strong>{money(total)}</strong> to any Taiga account below, then send your receipt on WhatsApp for verification.</p></div><div className="bank-account-grid">{BANK_ACCOUNTS.map(account=><article className={`bank-account-card ${selectedBank===account.id?"selected":""}`} key={account.id}><button type="button" className="bank-account-select" onClick={()=>setSelectedBank(account.id)} aria-pressed={selectedBank===account.id}><span className="bank-logo"><img src={account.logo} alt={`${account.bank} logo`} loading="eager" decoding="async"/></span><span className="bank-account-copy"><small>{account.bank}</small><strong>{account.accountNumber}</strong><span>{account.accountName}</span></span><span className="bank-selected-mark">{selectedBank===account.id?<Check/>:null}</span></button><button type="button" className="copy-account" onClick={()=>copyAccountNumber(account.accountNumber)}><Copy/>{copiedAccount===account.accountNumber?"Copied":"Copy account"}</button></article>)}</div><div className="secure-note bank-transfer-note"><ShieldCheck/> Payment is verified manually. Your order is confirmed only after Taiga receives your transfer receipt and verifies the funds.</div>{error&&<div className="checkout-error">{error}</div>}<div className="step-actions"><button onClick={()=>setStep(2)}>Back</button><a className="bank-proof-action" href={bankTransferWhatsappUrl()} target="_blank" rel="noreferrer"><MessageCircle/> I&apos;ve transferred — send proof</a></div></div>}</div><aside className="checkout-summary"><h3>Order summary</h3><div><span>Items total ({rows.reduce((sum,row)=>sum+(row.quantity??1),0)})</span><b>{money(subtotal)}</b></div><div><span>Delivery</span><b>{shipping===null?"Select a method":shipping===0?"FREE":money(shipping)}</b></div><div className="summary-total"><span>Total to transfer</span><strong>{money(total)}</strong></div><p>All prices and transfers are in Nigerian naira. Keep your receipt until your order is confirmed.</p></aside></div>}
  </aside></div>
}
