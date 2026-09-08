"use client";
/* eslint-disable @next/next/no-img-element -- Catalogue images are dynamic. */
import Link from "next/link";
import { use, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { ArrowLeft, UserRound, MapPin, Package, Heart, LockKeyhole, LogOut, ShoppingCart } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { AuthModal } from "../../components/AuthModal";
import { StorePanels } from "../../components/StorePanels";
import { nigeriaCities, nigeriaStates } from "../../data/nigeriaLocations";
import { emptyDeliveryAddress, readDeliveryAddress, validateDeliveryAddress } from "../../../lib/account-rules";
const money=(value:number|string)=>"₦"+Number(value).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
type Item={id:string;product_name:string;quantity:number;unit_price:number;selected_variant?:{image_url?:string;options?:Record<string,string>};products:{slug:string;image_url:string}|null};
type Order={id:string;order_number:string;status:string;created_at:string;total:number;subtotal:number;shipping:number;shipping_address:Record<string,string>;order_items:Item[]};
const menu=[{id:"account",label:"Account overview",icon:UserRound},{id:"profile",label:"Account information",icon:UserRound},{id:"address",label:"Delivery address",icon:MapPin},{id:"orders",label:"My orders",icon:Package},{id:"security",label:"Change password",icon:LockKeyhole}];
export default function AccountSection({params}:{params:Promise<{section:string}>}){
  const {section}=use(params),router=useRouter(),search=useSearchParams();
  const active=menu.some(item=>item.id===section)?section:"account";
  const [user,setUser]=useState<User|null>(null),[ready,setReady]=useState(false);
  const [drawer,setDrawer]=useState<"cart"|"wishlist"|null>(section==="cart"?"cart":section==="wishlist"?"wishlist":null);
  const [name,setName]=useState(""),[phone,setPhone]=useState(""),[address,setAddress]=useState(emptyDeliveryAddress);
  const [orders,setOrders]=useState<Order[]>([]),[loading,setLoading]=useState(false),[loadError,setLoadError]=useState("");
  const [message,setMessage]=useState(""),[busy,setBusy]=useState(false),[retry,setRetry]=useState(0);
  const [password,setPassword]=useState({current:"",next:"",confirm:""});
  const selected=orders.find(order=>order.id===search.get("order"));
  useEffect(()=>{
    let alive=true;
    supabase.auth.getSession().then(({data})=>{if(alive){setUser(data.session?.user??null);setReady(true)}}).catch(()=>{if(alive){setReady(true);setLoadError("Could not connect. Please try again.")}});
    const {data}=supabase.auth.onAuthStateChange((_event,session)=>{if(alive){setUser(session?.user??null);setReady(true)}});
    return()=>{alive=false;data.subscription.unsubscribe()};
  },[]);
  const userId=user?.id;
  useEffect(()=>{
    if(!userId)return;
    let alive=true;setLoading(true);setLoadError("");
    (async()=>{
      try{
        const [profile,result,auth]=await Promise.all([
          supabase.from("profiles").select("full_name").eq("id",userId).maybeSingle(),
          supabase.from("orders").select("id,order_number,status,created_at,total,subtotal,shipping,shipping_address,order_items(id,product_name,quantity,unit_price,selected_variant,products(slug,image_url))").eq("user_id",userId).order("created_at",{ascending:false}),
          supabase.auth.getUser()
        ]);
        if(!alive)return;
        if(profile.error||result.error||auth.error)throw new Error("Account details could not be loaded. Please try again.");
        const metadata=auth.data.user?.user_metadata??{};
        setName(profile.data?.full_name||metadata.full_name||"");setPhone(metadata.contact_phone||"");setAddress(readDeliveryAddress(metadata.delivery_address));
        setOrders((result.data??[]) as unknown as Order[]);
      }catch{if(alive)setLoadError("Account details could not be loaded. Please try again.")}
      finally{if(alive)setLoading(false)}
    })();return()=>{alive=false};
  },[userId,retry]);
  useEffect(()=>{setMessage("");setPassword({current:"",next:"",confirm:""})},[section]);
  async function save(event:FormEvent){
    event.preventDefault();if(!user||busy)return;setMessage("");setBusy(true);
    try{
      if(active==="profile"){
        if(name.trim().length<2)throw new Error("Enter your full name.");
        if(phone&&!/^(?:\+234|0)[789]\d{9}$/.test(phone.replace(/[\s()-]/g,"")))throw new Error("Enter a valid Nigerian phone number or leave it blank.");
        const profile=await supabase.from("profiles").update({full_name:name.trim()}).eq("id",user.id).select("id").single();if(profile.error)throw new Error("Could not save your name. Please try again.");
        const result=await supabase.auth.updateUser({data:{full_name:name.trim(),contact_phone:phone.trim()}});
        if(result.error)throw new Error("Your name was saved, but contact details could not be saved. Please try again.");
      }else if(active==="address"){
        const error=validateDeliveryAddress(address);if(error)throw new Error(error);
        const result=await supabase.auth.updateUser({data:{delivery_address:address}});if(result.error)throw new Error("Could not save your address. Please try again.");
      }else{
        if(password.next.length<8||password.next!==password.confirm)throw new Error("Use at least 8 characters and make sure the new passwords match.");
        const verified=await supabase.auth.signInWithPassword({email:user.email||"",password:password.current});
        if(verified.error)throw new Error("Your current password was not accepted.");
        const result=await supabase.auth.updateUser({password:password.next});if(result.error)throw new Error(result.error.message);
        setPassword({current:"",next:"",confirm:""});
      }
      setMessage(active==="address"?"Delivery address saved. It will be filled in at checkout.":"Changes saved.");
    }catch(error){setMessage(error instanceof Error?error.message:"Could not save. Please try again.")}finally{setBusy(false)}
  }
  async function logout(){const {error}=await supabase.auth.signOut({scope:"local"});if(error)setMessage("Could not sign out. Please try again.");else router.push("/")}
  return <div className="customer-area">
    <header className="customer-header"><Link href="/" className="logo"><span>T</span>Taiga<small>MARKET</small></Link><Link href="/shop"><ArrowLeft size={18}/> Continue shopping</Link><button type="button" onClick={()=>setDrawer("cart")}><ShoppingCart size={20}/> Cart</button></header>
    {!ready?<p className="customer-loading" role="status">Loading your account…</p>:!user?<AuthModal reason="Sign in to manage your account and orders." onClose={()=>router.push("/")}/>:<div className="customer-layout">
      <nav className="customer-nav" aria-label="Account navigation"><strong>My Taiga account</strong>{menu.map(({id,label,icon:Icon})=><Link key={id} href={"/account/"+id} aria-current={active===id?"page":undefined}><Icon size={18}/>{label}</Link>)}<button type="button" onClick={()=>setDrawer("wishlist")}><Heart size={18}/> Wishlist</button><button type="button" onClick={logout}><LogOut size={18}/> Sign out</button></nav>
      <main className="customer-content"><h1>{active==="orders"&&selected?"Order "+selected.order_number:menu.find(item=>item.id===active)?.label}</h1>
        {message&&<p className="customer-message" role="status">{message}</p>}
        {loading?<p role="status">Loading account details…</p>:loadError?<div role="alert"><p>{loadError}</p><button type="button" onClick={()=>setRetry(value=>value+1)}>Try again</button></div>:<>
        {active==="account"&&<div className="customer-card-grid"><section className="customer-card"><h2>Account details</h2><strong>{name||"Taiga customer"}</strong><p>{user.email}</p>{phone&&<p>{phone}</p>}<Link href="/account/profile">Edit account information</Link></section><section className="customer-card"><h2>Delivery address</h2>{address.line1?<><strong>{address.first_name} {address.last_name}</strong><p>{address.line1}<br/>{address.city}, {address.state}</p><p>{address.phone}</p></>:<p>No default delivery address saved.</p>}<Link href="/account/address">{address.line1?"Edit delivery address":"Add delivery address"}</Link></section><section className="customer-card"><h2>Orders</h2><p>{orders.length} orders in your history</p><Link href="/account/orders">View your orders</Link></section><section className="customer-card"><h2>Account security</h2><p>Manage your password.</p><Link href="/account/security">Change password</Link></section></div>}
        {active==="profile"&&<form className="customer-form" onSubmit={save}><label>Name<input value={name} onChange={e=>setName(e.target.value)} required minLength={2} maxLength={80} autoComplete="name"/></label><label>Email address<input value={user.email||""} readOnly type="email"/></label><label>Phone number<input value={phone} onChange={e=>setPhone(e.target.value)} type="tel" autoComplete="tel" maxLength={20} placeholder="08030000000"/></label><button disabled={busy}>{busy?"Saving…":"Save changes"}</button></form>}
        {active==="address"&&<form className="customer-form" onSubmit={save}>{([["first_name","First name"],["last_name","Last name"],["phone","Phone number"],["line1","Street address"]] as const).map(([key,label])=><label key={key}>{label}<input value={address[key]} onChange={e=>setAddress(current=>({...current,[key]:e.target.value}))} required maxLength={key==="line1"?160:50} type={key==="phone"?"tel":"text"}/></label>)}<label>State<select required value={address.state} onChange={e=>setAddress(current=>({...current,state:e.target.value,city:""}))}><option value="">Select state</option>{nigeriaStates.map(state=><option key={state}>{state}</option>)}</select></label><label>City<select required value={address.city} onChange={e=>setAddress(current=>({...current,city:e.target.value}))}><option value="">Select city</option>{(nigeriaCities[address.state]||[]).map(city=><option key={city}>{city}</option>)}</select></label><label>Delivery instructions (optional)<textarea value={address.additional_info} maxLength={200} onChange={e=>setAddress(current=>({...current,additional_info:e.target.value}))}/></label><button disabled={busy}>{busy?"Saving…":"Save delivery address"}</button></form>}
        {active==="security"&&<form className="customer-form" onSubmit={save}><p>For accounts created with email and password.</p>{([["current","Current password"],["next","New password"],["confirm","Confirm new password"]] as const).map(([key,label])=><label key={key}>{label}<input type="password" value={password[key]} onChange={e=>setPassword(current=>({...current,[key]:e.target.value}))} required minLength={key==="current"?1:8} autoComplete={key==="current"?"current-password":"new-password"}/></label>)}<button disabled={busy}>{busy?"Saving…":"Change password"}</button></form>}
        {active==="orders"&&(selected?<><Link className="customer-back" href="/account/orders"><ArrowLeft size={16}/> All orders</Link><div className="customer-order-heading"><p>Placed {new Date(selected.created_at).toLocaleDateString()}</p><span className={"status "+selected.status}>{selected.status}</span></div><section className="customer-order-items"><h2>Purchased products</h2>{selected.order_items.map(item=><article className="customer-order-item" key={item.id}>{item.selected_variant?.image_url||item.products?.image_url?<img src={item.selected_variant?.image_url||item.products?.image_url} alt={item.product_name}/>:<div className="customer-image-empty"><Package/></div>}<div><h3>{item.product_name}</h3>{item.selected_variant?.options&&<p>{Object.entries(item.selected_variant.options).map(([key,value])=>key+": "+value).join(" · ")}</p>}<p>Quantity: {item.quantity}</p><p>Unit price: {money(item.unit_price)}</p>{item.products?.slug&&<Link href={"/product/"+item.products.slug}>View product details</Link>}</div><strong>{money(Number(item.unit_price)*item.quantity)}</strong></article>)}</section><div className="customer-card-grid"><section className="customer-card"><h2>Delivery address</h2><p>{selected.shipping_address.first_name} {selected.shipping_address.last_name}</p><p>{selected.shipping_address.line1}<br/>{selected.shipping_address.city}, {selected.shipping_address.state}</p><p>{selected.shipping_address.phone}</p></section><section className="customer-card"><h2>Order summary</h2><dl className="customer-totals"><div><dt>Subtotal</dt><dd>{money(selected.subtotal)}</dd></div><div><dt>Delivery</dt><dd>{money(selected.shipping)}</dd></div><div><dt>Total</dt><dd>{money(selected.total)}</dd></div></dl></section></div></>:orders.length?<div className="customer-orders">{search.get("order")&&<p role="status">That order was not found in your account.</p>}{orders.map(order=><article className="customer-order-card" key={order.id}><div><h2>{order.order_number}</h2><p>{new Date(order.created_at).toLocaleDateString()}</p><span className={"status "+order.status}>{order.status}</span></div><div><p>{order.order_items.map(item=>item.product_name+" × "+item.quantity).join(", ")}</p><strong>{money(order.total)}</strong></div><Link href={"/account/orders?order="+order.id}>View order details</Link></article>)}</div>:<div className="customer-card"><h2>No orders yet</h2><p>Your confirmed orders will appear here.</p><Link href="/shop">Browse products</Link></div>)}
        </>}
      </main>
    </div>}
    {user&&drawer&&<StorePanels key={drawer} kind={drawer} user={user} onClose={()=>setDrawer(null)} onChanged={()=>{}}/>}
  </div>;
}
