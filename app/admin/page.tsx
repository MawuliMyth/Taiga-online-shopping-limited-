"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { 
  BarChart3, Bell, Boxes, ChevronDown, CircleDollarSign, ImagePlus, 
  LayoutDashboard, LogOut, Package, Plus, Search, Settings, 
  ShoppingCart, Store, Tags, Trash2, Truck, Users, Wallet, X, PackageCheck,
  TrendingUp, ArrowUpRight, ArrowDownRight, Edit3, ClipboardCheck,
  ToggleLeft, ToggleRight, Minus, Eye, CheckCircle2, AlertTriangle, AlertCircle, ArrowRight, Clock, ShieldCheck
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useSessionTimeout } from "../../lib/use-session-timeout";
import { AuthModal } from "../components/AuthModal";

type Tab="Dashboard"|"Orders"|"Products"|"Customers"|"Administrators"|"Categories"|"Analytics"|"Marketing"|"Audit Logs"|"Settings";
const navigation:[Tab,any][]=[
  ["Dashboard", LayoutDashboard],
  ["Orders", ShoppingCart],
  ["Products", Package],
  ["Customers", Users],
  ["Administrators", ShieldCheck],
  ["Categories", Tags],
  ["Analytics", BarChart3],
  ["Marketing", Bell],
  ["Audit Logs", ClipboardCheck],
  ["Settings", Settings]
];
const emptyProduct={name:"",slug:"",description:"",price:"",compare_at_price:"",image_url:"",badge:"New",inventory:"0",category_id:"",is_active:true,variants:"[]",specifications:"{}",warranty_value:"0",warranty_unit:"months",warranty_notes:"",returnable:true};

export default function Admin(){
  const [tab,setTab]=useState<Tab>("Dashboard"),
        [access,setAccess]=useState<"checking"|"guest"|"denied"|"allowed"|"setup">("checking"),
        [auth,setAuth]=useState(false),
        [adminUser,setAdminUser]=useState({name:"Administrator",email:""});
  
  const [products,setProducts]=useState<any[]>([]),
        [orders,setOrders]=useState<any[]>([]),
        [customers,setCustomers]=useState<any[]>([]),
        [administrators,setAdministrators]=useState<any[]>([]),
        [auditLogs,setAuditLogs]=useState<any[]>([]),
        [categories,setCategories]=useState<any[]>([]),
        [subscribers,setSubscribers]=useState<any[]>([]),
        [loading,setLoading]=useState(true),
        [search,setSearch]=useState("");
  
  const [page,setPage]=useState(1),[editing,setEditing]=useState<any|null>(null),
        [editingBanner,setEditingBanner]=useState<any|null>(null),
        [banners,setBanners]=useState<any[]>([]),
        [categoryName,setCategoryName]=useState(""),
        [productView,setProductView]=useState<"all"|"active"|"draft"|"low">("all"),
        [notice,setNotice]=useState(""),
        [commerceTablesReady,setCommerceTablesReady]=useState(true);

  const [storeSettings,setStoreSettings]=useState<any>({
    store_name:"Taiga Online Shopping Limited",
    support_email:"support@taiga.ng",
    support_phone:"0800 466 3639",
    free_shipping_threshold:50000,
    standard_shipping_fee:2500,
    pickup_shipping_fee:1500,
    announcement_left:"",
    announcement_center:"",
    announcement_right:"",
    flash_sale_title:"Flash Sales",
    flash_sale_ends_at:""
  });

  // Quick order viewer state
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<any | null>(null);
  useSessionTimeout(30,()=>{setEditing(null);setEditingBanner(null);setNotice("Your admin session timed out after 30 minutes of inactivity. Please sign in again.")});

  async function check(){
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){
      setAdminUser({name:"Administrator",email:""});
      return setAccess("guest");
    }
    const {data,error}=await supabase.from("profiles").select("role,full_name").eq("id",user.id).maybeSingle();
    if(error) return setAccess("setup");
    setAdminUser({
      name: data?.full_name||user.user_metadata?.full_name||user.email?.split("@")[0]||"Administrator",
      email: user.email||""
    });
    setAccess(data?.role==="admin"?"allowed":"denied");
  }

  async function load(){
    setLoading(true);
    const [p,o,cats,users,subs,settingsResult,bannerResult,imageRows,logsResult]=await Promise.all([
      supabase.from("products").select("*,categories(name)").order("created_at",{ascending:false}),
      supabase.from("orders").select("*,order_items(product_name,quantity,unit_price,selected_variant)").order("created_at",{ascending:false}),
      supabase.from("categories").select("*").order("name"),
      supabase.from("profiles").select("*").order("created_at",{ascending:false}),
      supabase.from("newsletter_subscribers").select("*").order("created_at",{ascending:false}),
      supabase.from("store_settings").select("*").eq("id",1).maybeSingle(),
      supabase.from("banners").select("*").order("placement").order("sort_order"),
      supabase.from("product_images").select("*").order("sort_order"),
      supabase.from("admin_audit_logs").select("*").order("created_at",{ascending:false}).limit(500)
    ]);
    
    setProducts((p.data??[]).map((product:any)=>({
      ...product,
      product_images:(imageRows.data??[]).filter((image:any)=>image.product_id===product.id)
    })));
    setOrders(o.data??[]);
    setCategories(cats.data??[]);
    setCustomers((users.data??[]).filter((profile:any)=>profile.role==="customer"));
    setAdministrators((users.data??[]).filter((profile:any)=>profile.role==="admin"));
    setAuditLogs(logsResult.data??[]);
    setSubscribers(subs.data??[]);
    if(settingsResult.data) setStoreSettings(settingsResult.data);
    setBanners(bannerResult.data??[]);
    setCommerceTablesReady(!bannerResult.error&&!imageRows.error);
    setLoading(false);
  }

  useEffect(()=>{
    check();
    const {data}=supabase.auth.onAuthStateChange(()=>check());
    return()=>data.subscription.unsubscribe();
  },[]);

  useEffect(()=>{
    if(access==="allowed") load();
  },[access]);

  function flash(s:string){
    setNotice(s);
    setTimeout(()=>setNotice(""),2500);
  }

  async function setAdministrator(id:string,enabled:boolean){
    if(!confirm(enabled?"Grant this customer administrator access?":"Remove administrator access from this account?"))return;
    const {error}=await supabase.rpc("set_administrator",{target_user:id,make_admin:enabled});
    if(error)return flash(error.message.includes("schema cache")?"Run the RBAC migration in Supabase first.":error.message);
    flash(enabled?"Administrator access granted":"Administrator access removed");
    await load();
  }

  async function saveProduct(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();
    const f=new FormData(e.currentTarget),payload:any={};
    for(const k of Object.keys(emptyProduct)) payload[k]=f.get(k);
    payload.name=String(payload.name).trim();
    payload.slug=String(payload.slug).trim().toLowerCase();
    payload.description=String(payload.description??"").trim();
    if(payload.name.length<2) return flash("Product name must contain at least 2 characters.");
    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(payload.slug)) return flash("Slug may only contain lowercase letters, numbers and single hyphens.");
    payload.price=Number(payload.price);
    payload.compare_at_price=payload.compare_at_price?Number(payload.compare_at_price):null;
    payload.inventory=Number(payload.inventory);
    try{payload.variants=JSON.parse(String(payload.variants||"[]"))}catch{return flash("Product variants could not be read. Remove the invalid row and try again.")}
    try{payload.specifications=JSON.parse(String(payload.specifications||"{}"))}catch{return flash("Product specifications could not be read. Remove the invalid row and try again.")}
    if(!Array.isArray(payload.variants)) return flash("Product variants must be a list.");
    const variantSignatures=new Set<string>();
    for(const variant of payload.variants){
      if(!variant.id||!variant.options||!Object.keys(variant.options).length) return flash("Each variant needs at least one option, such as Size, Colour or Storage.");
      variant.options=Object.fromEntries(Object.entries(variant.options).map(([name,value])=>[String(name).trim(),String(value).trim()]).filter(([name,value])=>name&&value));
      if(!Object.keys(variant.options).length)return flash("Enter a value for every option in each variant combination.");
      const signature=Object.entries(variant.options).sort(([a],[b])=>a.localeCompare(b)).map(([name,value])=>`${name.toLowerCase()}:${String(value).toLowerCase()}`).join("|");
      if(variantSignatures.has(signature))return flash("Each variant combination must be unique.");
      variantSignatures.add(signature);
      if(!Number.isInteger(Number(variant.inventory))||Number(variant.inventory)<0) return flash("Every variant inventory must be a whole number of zero or more.");
      if(variant.price!==null&&variant.price!==""&&(!Number.isFinite(Number(variant.price))||Number(variant.price)<=0)) return flash("Every variant price must be greater than zero or left blank.");
      if(variant.discounted_price!==null&&variant.discounted_price!==""&&(!Number.isFinite(Number(variant.discounted_price))||Number(variant.discounted_price)<=0)) return flash("Every discounted variant price must be greater than zero or left blank.");
      if(variant.discounted_price&&variant.price&&Number(variant.discounted_price)>=Number(variant.price))return flash("A discounted variant price must be lower than its regular price.");
      variant.inventory=Number(variant.inventory);variant.price=variant.price===""||variant.price===null?null:Number(variant.price);variant.discounted_price=variant.discounted_price===""||variant.discounted_price===null?null:Number(variant.discounted_price);
    }
    if(payload.variants.length) payload.inventory=payload.variants.reduce((sum:number,variant:any)=>sum+variant.inventory,0);
    payload.warranty_value=Number(payload.warranty_value||0);
    if(!Number.isInteger(payload.warranty_value)||payload.warranty_value<0||payload.warranty_value>120)return flash("Warranty duration must be a whole number from 0 to 120.");
    payload.returnable=f.get("returnable")==="yes";
    if(!Number.isFinite(payload.price)||payload.price<=0) return flash("Enter a valid product price greater than zero.");
    if(payload.compare_at_price!==null&&payload.compare_at_price<payload.price) return flash("Compare price cannot be lower than the selling price.");
    if(!Number.isInteger(payload.inventory)||payload.inventory<0) return flash("Inventory must be a whole number of zero or more.");
    payload.is_active=f.get("is_active")==="on";
    const gallery=JSON.parse(String(f.get("gallery_urls")||"[]"));
    if(gallery.length<3||gallery.length>10||gallery.some((url:string)=>{try{const parsed=new URL(url);return !["http:","https:"].includes(parsed.protocol)}catch{return true}})) return flash("Add 3 to 10 valid product images before saving.");
    payload.image_url=gallery[0];
    const result=await supabase.rpc("save_product_with_gallery",{product_key:editing?.id??null,payload,gallery});
    if(result.error){
      if(result.error.code==="PGRST205"||result.error.message.toLowerCase().includes("schema cache")){setCommerceTablesReady(false);return flash("Commerce database tables are missing. Run supabase/upgrade-live-commerce.sql in the Supabase SQL Editor.")}
      return flash(result.error.message);
    }
    setEditing(null);
    await load();
    flash("Product and gallery saved");
  }

  async function uploadImage(file:File,setUrl:(url:string)=>void){
    if(!["image/jpeg","image/png","image/webp"].includes(file.type))return flash("Upload a JPG, PNG or WebP image.");
    if(file.size>8*1024*1024)return flash("Images must be 8 MB or smaller.");
    const path=`${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi,"-")}`;
    const {error}=await supabase.storage.from("product-images").upload(path,file);
    if(error) return flash(error.message);
    const {data}=supabase.storage.from("product-images").getPublicUrl(path);
    setUrl(data.publicUrl);
  }

  async function removeProduct(id:string){
    if(!confirm("Delete this product?")) return;
    const {error}=await supabase.from("products").delete().eq("id",id);
    if(error) return flash(error.message);
    load();
  }

  // Quick action: Toggle product is_active state
  async function toggleProductActive(id:string, currentStatus:boolean){
    const {error}=await supabase.from("products").update({is_active: !currentStatus}).eq("id",id);
    if(error) return flash(error.message);
    flash(`Product status changed to ${!currentStatus ? "Active" : "Draft"}`);
    load();
  }

  // Quick action: Increment product inventory
  async function adjustProductStock(id:string, currentStock:number, amount:number){
    const nextStock = Math.max(0, currentStock + amount);
    const {error}=await supabase.from("products").update({inventory: nextStock}).eq("id",id);
    if(error) return flash(error.message);
    flash(`Product stock updated to ${nextStock}`);
    load();
  }

  async function orderStatus(id:string,status:string){
    const {error}=await supabase.from("orders").update({status,updated_at:new Date().toISOString()}).eq("id",id);
    if(error) return flash(error.message);
    await supabase.rpc("write_admin_log",{log_action:"order.status_changed",log_entity_type:"order",log_entity_id:id,log_details:{status}});
    load();
  }

  async function addCategory(e:React.FormEvent){
    e.preventDefault();
    const cleanName=categoryName.trim();
    if(cleanName.length<2||cleanName.length>60) return flash("Category name must contain between 2 and 60 characters.");
    const slug=cleanName.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
    const {error}=await supabase.from("categories").insert({name:cleanName,slug});
    if(error) return flash(error.message);
    setCategoryName("");
    load();
  }

  async function deleteCategory(id:string){
    const {error}=await supabase.from("categories").delete().eq("id",id);
    if(error) return flash(error.message);
    load();
  }

  async function saveSettings(e:React.FormEvent){
    e.preventDefault();
    const email=String(storeSettings.support_email??"").trim().toLowerCase(),phone=String(storeSettings.support_phone??"").replace(/[\s()-]/g,"");
    if(String(storeSettings.store_name??"").trim().length<2) return flash("Enter a valid store name.");
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return flash("Enter a valid support email address.");
    if(!/^(?:\+234|0)(?:7[0-9]|8[0-9]|9[0-1])[0-9]{8}$/.test(phone)) return flash("Enter a valid Nigerian support phone number.");
    if(!Number.isFinite(Number(storeSettings.standard_shipping_fee))||Number(storeSettings.standard_shipping_fee)<0) return flash("Standard delivery fee must be zero or more.");
    if(!Number.isFinite(Number(storeSettings.pickup_shipping_fee))||Number(storeSettings.pickup_shipping_fee)<0) return flash("Pickup fee must be zero or more.");
    const sanitizedSettings={...storeSettings,store_name:String(storeSettings.store_name).trim(),support_email:email,support_phone:phone};
    setStoreSettings(sanitizedSettings);
    const {error}=await supabase.from("store_settings").update({...sanitizedSettings,updated_at:new Date().toISOString()}).eq("id",1);
    flash(error?error.message:"Store settings saved");
  }

  async function saveBanner(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault();
    const f=new FormData(e.currentTarget);
    const bannerImages=JSON.parse(String(f.get("image_urls")||"[]")).filter(Boolean);
    const payload:any={
      placement:f.get("placement"),
      badge:f.get("badge"),
      title:f.get("title"),
      accent_text:f.get("accent_text")||null,
      subtitle:f.get("subtitle"),
      image_url:bannerImages[0]||f.get("image_url"),
      image_urls:bannerImages,
      cta_label:f.get("cta_label"),
      cta_link:f.get("cta_link"),
      background_color:f.get("background_color"),
      sort_order:Number(f.get("sort_order")),
      is_active:f.get("is_active")==="on",
      updated_at:new Date().toISOString()
    };
    payload.title=String(payload.title).trim();payload.cta_label=String(payload.cta_label).trim();payload.cta_link=String(payload.cta_link).trim();payload.image_url=String(payload.image_url).trim();
    if(payload.title.length<2) return flash("Banner headline must contain at least 2 characters.");
    if(payload.cta_label.length<2) return flash("Button label must contain at least 2 characters.");
    if(!/^(?:https?:\/\/|\/|#)/.test(payload.cta_link)) return flash("Button link must be a full URL, site path, or section link.");
    if(!bannerImages.length)return flash("Add at least one banner image.");
    if(bannerImages.some((url:string)=>{try{const image=new URL(url);return !["http:","https:"].includes(image.protocol)}catch{return true}}))return flash("Every banner image must use a valid http or https URL.");
    if(!Number.isInteger(payload.sort_order)||payload.sort_order<0) return flash("Display order must be a whole number of zero or more.");
    const result=editingBanner?.id
      ? await supabase.from("banners").update(payload).eq("id",editingBanner.id)
      : await supabase.from("banners").insert(payload);
    if(result.error){
      if(result.error.code==="PGRST205"||result.error.message.toLowerCase().includes("schema cache")){setCommerceTablesReady(false);return flash("Banner database tables are missing. Run supabase/upgrade-live-commerce.sql in the Supabase SQL Editor.")}
      return flash(result.error.message);
    }
    setEditingBanner(null);
    load();
    flash("Banner saved");
  }

  async function deleteBanner(id:string){
    if(!confirm("Delete this banner?")) return;
    const {error}=await supabase.from("banners").delete().eq("id",id);
    if(error) return flash(error.message);
    load();
  }

  const revenue=orders.filter(o=>o.status!=="cancelled").reduce((s,o)=>s+Number(o.total),0),
        avg=orders.length?revenue/orders.length:0,
        low=products.filter(p=>p.inventory<10).length;
        
  const filteredProducts=products.filter(p=>{
    const matchesSearch=p.name.toLowerCase().includes(search.toLowerCase())||String(p.sku??"").toLowerCase().includes(search.toLowerCase());
    const matchesView=productView==="all"||(productView==="active"&&p.is_active)||(productView==="draft"&&!p.is_active)||(productView==="low"&&p.inventory<10);
    return matchesSearch&&matchesView;
  });

  // Fulfillment pipeline stats calculations
  const ordersPipeline = useMemo(() => {
    const pipeline = { pending: 0, paid: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0 };
    orders.forEach(o => {
      const s = o.status as keyof typeof pipeline;
      if (pipeline[s] !== undefined) pipeline[s]++;
    });
    return pipeline;
  }, [orders]);

  if(access!=="allowed") return <main style={{minHeight:"100vh",display:"grid",gridTemplateColumns:"minmax(320px,.92fr) minmax(420px,1.08fr)",background:"#f4f7f5",fontFamily:'Inter,system-ui,-apple-system,"Segoe UI",sans-serif',color:"#13201c"}}>
    {auth&&<AuthModal showGoogle={false} onClose={()=>setAuth(false)} reason="Please sign in with an authorized administrator account to continue."/>}
    <section style={{position:"relative",overflow:"hidden",display:"flex",flexDirection:"column",justifyContent:"space-between",padding:"48px clamp(32px,5vw,76px)",background:"linear-gradient(145deg,#082f25 0%,#0b604a 58%,#0d7a5f 100%)",color:"white"}}>
      <div aria-hidden="true" style={{position:"absolute",width:420,height:420,borderRadius:"50%",border:"1px solid rgba(255,255,255,.12)",right:-150,top:-120}}/>
      <div aria-hidden="true" style={{position:"absolute",width:260,height:260,borderRadius:"50%",background:"rgba(255,255,255,.055)",left:-90,bottom:-70}}/>
      <Link href="/" style={{position:"relative",display:"inline-flex",alignItems:"center",gap:13,color:"white",textDecoration:"none",fontSize:25,fontWeight:900,letterSpacing:"-.04em"}}><span style={{width:46,height:46,display:"grid",placeItems:"center",borderRadius:13,background:"white",color:"#0d7a5f",boxShadow:"0 12px 28px rgba(0,0,0,.2)"}}>T</span><span>Taiga<small style={{display:"block",fontSize:9,letterSpacing:".22em",color:"#a7f3d0",marginTop:2}}>ADMINISTRATION</small></span></Link>
      <div style={{position:"relative",maxWidth:520}}><span style={{display:"inline-flex",padding:"7px 11px",border:"1px solid rgba(255,255,255,.18)",borderRadius:999,background:"rgba(255,255,255,.08)",fontSize:11,fontWeight:800,letterSpacing:".12em",textTransform:"uppercase"}}>Secure operations</span><h1 style={{fontSize:"clamp(38px,5vw,64px)",lineHeight:1.02,letterSpacing:"-.055em",margin:"22px 0 18px",fontWeight:900}}>Run your store with clarity.</h1><p style={{maxWidth:460,color:"rgba(255,255,255,.76)",fontSize:16,lineHeight:1.7}}>Manage products, fulfil orders, publish campaigns and monitor performance from one protected workspace.</p></div>
      <p style={{position:"relative",fontSize:11,color:"rgba(255,255,255,.55)"}}>Taiga Online Shopping Limited · Authorized personnel only</p>
    </section>
    <section style={{display:"grid",placeItems:"center",padding:"40px 24px"}}>
      <div style={{width:"min(440px,100%)",background:"white",border:"1px solid #dfe7e3",borderRadius:18,padding:"clamp(28px,5vw,46px)",boxShadow:"0 24px 70px rgba(15,40,31,.09)"}}>
        <div style={{width:52,height:52,display:"grid",placeItems:"center",borderRadius:14,background:"#e8f6f0",color:"#0d7a5f",marginBottom:24}}><Store size={25}/></div>
        <span style={{fontSize:11,fontWeight:900,letterSpacing:".13em",textTransform:"uppercase",color:"#0d7a5f"}}>Administration portal</span>
        <h2 style={{fontSize:30,lineHeight:1.15,letterSpacing:"-.035em",margin:"9px 0 10px",fontWeight:900}}>{access==="checking"?"Verifying access…":access==="setup"?"Database update needed":access==="denied"?"Access restricted":"Welcome back"}</h2>
        <p style={{fontSize:14,lineHeight:1.65,color:"#64736d",marginBottom:26}}>{access==="setup"?"The commerce database must be upgraded before administrators can continue.":access==="denied"?"This account is signed in, but it has not been assigned the administrator role.":access==="checking"?"Securely checking your administrator session.":"Sign in with an authorized administrator account to continue."}</p>
        {access==="checking"&&<div style={{height:4,borderRadius:999,background:"#e5ece9",overflow:"hidden",marginBottom:22}}><span style={{display:"block",width:"58%",height:"100%",background:"#0d7a5f",borderRadius:999}}/></div>}
        {access==="guest"&&<button onClick={()=>setAuth(true)} style={{width:"100%",minHeight:50,border:0,borderRadius:10,background:"#0d7a5f",color:"white",fontSize:14,fontWeight:800,cursor:"pointer",boxShadow:"0 10px 24px rgba(13,122,95,.2)"}}>Sign in securely</button>}
        {access==="denied"&&<button onClick={()=>supabase.auth.signOut()} style={{width:"100%",minHeight:50,border:"1px solid #dfe7e3",borderRadius:10,background:"white",color:"#13201c",fontSize:14,fontWeight:800,cursor:"pointer"}}>Sign out and use another account</button>}
        <Link href="/" style={{display:"block",marginTop:18,textAlign:"center",color:"#0d7a5f",fontSize:13,fontWeight:750,textDecoration:"none"}}>← Return to storefront</Link>
      </div>
    </section>
    <style>{`@media(max-width:850px){main{grid-template-columns:1fr!important}main>section:first-of-type{min-height:360px;padding:32px 24px!important}main>section:first-of-type h1{font-size:42px!important}main>section:last-of-type{padding:28px 16px!important}}`}</style>
  </main>;
  
  return <div className="dashboard-shell" style={{ display: "grid", gridTemplateColumns: "278px 1fr" }}>{notice&&<div className="toast">{notice}</div>}
    <aside className="sidebar" style={{ width: "100%", height: "100vh", position: "sticky", top: 0, overflowY: "auto", overflowX: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", padding: "16px 20px" }}>
        <Link href="/" className="logo"><span>T</span>Taiga<small>ADMIN</small></Link>
      </div>

      <p className="side-label" style={{ paddingLeft: "20px" }}>Store management</p>
      
      <nav className="side-nav" aria-label="Admin sections" style={{ flex: 1, padding: "0 10px" }}>
        {navigation.map(([name,Icon])=><button key={name} onClick={()=>setTab(name)} className={tab===name?"active":""} style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", gap: "12px", width: "100%", padding: "10px 14px", borderRadius: "var(--radius-md)", marginBottom: "4px" }} title={name}><Icon size={17}/><span>{name}</span>{name==="Orders"&&<i style={{ marginLeft: "auto" }}>{orders.length}</i>}</button>)}
      </nav>
      
      <nav className="side-nav sidebar-bottom" style={{ padding: "10px" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", width: "100%" }}><Store/><span>View store</span></Link>
        <button onClick={()=>supabase.auth.signOut()} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", width: "100%", background: "none", border: "none" }}><LogOut/><span>Sign out</span></button>
      </nav>
    </aside>

    <main className="dash-main">
      <header className="dash-topbar">
        <div className="dash-search"><Search/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={tab==="Products"?"Search products...":"Search this admin section..."} aria-label={`Search ${tab}`}/><kbd>Enter</kbd></div>
        <div className="topbar-tools"><button aria-label="Notifications" title="Notifications"><Bell size={18}/></button><button aria-label="Store settings" title="Store settings" onClick={()=>setTab("Settings")}><Settings size={18}/></button></div>
        
        <button className="profile" onClick={()=>setTab("Settings")} aria-label="Open store settings">
          <div className="admin-avatar">{adminUser.name.split(/\s+/).slice(0,2).map(n=>n[0]).join("").toUpperCase()}</div>
          <div style={{ textAlign: "left" }}>
            <strong style={{ display: "block" }}>{adminUser.name}</strong>
            <small style={{ display: "block", color: "var(--muted)", fontSize: "10px" }}>{adminUser.email||"Administrator"}</small>
          </div>
          <ChevronDown size={14}/>
        </button>
      </header>

      <div className="dash-content">
        {(low>0||ordersPipeline.pending>0)&&<aside className="operations-alert" aria-label="Operations requiring attention">
          <div className="operations-alert-icon"><AlertTriangle size={18}/></div>
          <div><strong>Store operations need attention</strong><span>{low>0?`${low} product${low===1?"":"s"} below the stock threshold. `:""}{ordersPipeline.pending>0?`${ordersPipeline.pending} order${ordersPipeline.pending===1?"":"s"} awaiting payment or review.`:""}</span></div>
          <div className="operations-alert-actions">{low>0&&<button onClick={()=>{setProductView("low");setTab("Products")}}>Review stock <ArrowRight size={14}/></button>}{ordersPipeline.pending>0&&<button onClick={()=>setTab("Orders")}>Open orders <ArrowRight size={14}/></button>}</div>
        </aside>}
        <div className="dash-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span className="admin-eyebrow">Taiga Commerce Console</span>
            <h1 style={{ fontSize: "28px", fontWeight: 900, marginTop: "4px" }}>{tab}</h1>
            <p style={{ fontSize: "13px", color: "var(--muted)" }}>Manage and monitor Taiga Online Shopping Limited in real time.</p>
          </div>
          <div className="heading-actions"><div className="admin-date"><Clock size={16}/>{new Intl.DateTimeFormat("en-NG",{day:"2-digit",month:"short",year:"numeric"}).format(new Date())}</div>{tab==="Products"&&<button className="primary-action" onClick={()=>setEditing({...emptyProduct})} style={{ padding: "10px 20px", display: "flex", gap: "8px", alignItems: "center" }}><Plus/> Add product</button>}</div>
        </div>

        {loading ? <div className="admin-loading">Loading live store data…</div> : <>
          {tab==="Dashboard" && (
            <>
              {/* Stripe-like Analytics Cards */}
              <section className="stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", margin: "24px 0" }}>
                <Stat icon={CircleDollarSign} label="Gross Revenue" value={`₦${revenue.toLocaleString()}`} trend="+14.2%" trendUp={true} />
                <Stat icon={ShoppingCart} label="Order Count" value={orders.length} trend="+8.5%" trendUp={true} />
                <Stat icon={Users} label="Total Customers" value={customers.length} trend="+18.1%" trendUp={true} />
                <Stat icon={Boxes} label="Low Stock Items" value={low} trend={low > 0 ? "Needs restock" : "All clear"} trendUp={low === 0} />
              </section>

              {/* Core visual grid */}
              <section className="dash-grid" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "24px", margin: "24px 0" }}>
                <div className="panel" style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "24px" }}>
                  <PanelTitle title="Revenue chart" sub="Visual display of order sizes in recent history" />
                  <div className="chart" style={{ display: "flex", alignItems: "flex-end", height: "180px", gap: "6px", marginTop: "24px", paddingBottom: "10px", borderBottom: "1px solid var(--border)" }}>
                    {orders.slice(0, 24).reverse().map((o, i) => (
                      <div className="bar-wrap" key={o.id} style={{ flex: 1, height: "100%", display: "flex", alignItems: "flex-end" }} title={`${o.order_number}: ₦${o.total.toLocaleString()}`}>
                        <div 
                          className="bar" 
                          style={{ 
                            width: "100%",
                            height: `${Math.max(8, Math.min(100, Number(o.total) / (Math.max(...orders.map(x => Number(x.total)), 1)) * 100))}%`, 
                            background: "var(--primary)",
                            borderRadius: "2px 2px 0 0",
                            transition: "height 0.3s ease"
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="panel" style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "24px" }}>
                  <PanelTitle title="Fulfillment pipeline" sub="Visual progress of order processing states" />
                  <div style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "12px" }}>
                    {[
                      { state: "pending", label: "Pending Payment", color: "#fbbe24" },
                      { state: "paid", label: "Paid", color: "#6366f1" },
                      { state: "processing", label: "Packing", color: "#3b82f6" },
                      { state: "shipped", label: "Transit", color: "#06b6d4" },
                      { state: "delivered", label: "Delivered", color: "var(--success)" },
                      { state: "cancelled", label: "Cancelled", color: "var(--danger)" }
                    ].map(pipelineItem => {
                      const count = ordersPipeline[pipelineItem.state as keyof typeof ordersPipeline] || 0;
                      const pct = orders.length ? (count / orders.length) * 100 : 0;
                      
                      return (
                        <div key={pipelineItem.state} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", fontWeight: "700" }}>
                            <span style={{ color: "var(--foreground)" }}>{pipelineItem.label}</span>
                            <span style={{ color: "var(--muted)" }}>{count} ({Math.round(pct)}%)</span>
                          </div>
                          <div style={{ height: "6px", background: "var(--border)", borderRadius: "var(--radius-full)", overflow: "hidden" }}>
                            <div style={{ width: `${pct}%`, height: "100%", background: pipelineItem.color, borderRadius: "var(--radius-full)" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>

              <OrdersTable orders={orders.slice(0,6)} change={orderStatus} onViewDetails={setSelectedOrderDetails} />
            </>
          )}

          {tab==="Orders" && <OrdersTable orders={orders} change={orderStatus} onViewDetails={setSelectedOrderDetails} />} 

          {tab==="Products" && (
            <>
            <section className="catalogue-command-bar" aria-label="Product catalogue summary">
              <div><span>Catalogue</span><strong>{products.length}</strong><small>Total products</small></div>
              <div><span>Live</span><strong>{products.filter(p=>p.is_active).length}</strong><small>Visible in store</small></div>
              <div><span>Drafts</span><strong>{products.filter(p=>!p.is_active).length}</strong><small>Hidden products</small></div>
              <div><span>Attention</span><strong>{low}</strong><small>Low stock</small></div>
            </section>
            <div className="catalogue-toolbar">
              <div className="catalogue-view-tabs" role="group" aria-label="Filter products">
                {(["all","active","draft","low"] as const).map(view=><button key={view} className={productView===view?"active":""} onClick={()=>{setProductView(view);setPage(1)}}>{view==="all"?"All products":view==="active"?"Live":view==="draft"?"Drafts":"Low stock"}</button>)}
              </div>
              <span>{filteredProducts.length} result{filteredProducts.length===1?"":"s"}</span>
            </div>
            <div className="admin-table-wrap" style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
              <table className="admin-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--secondary)", borderBottom: "1px solid var(--border)" }}>
                    <th style={{ padding: "16px", textAlign: "left", fontSize: "11px", fontWeight: "800", textTransform: "uppercase", color: "var(--muted)" }}>Product</th>
                    <th style={{ padding: "16px", textAlign: "left", fontSize: "11px", fontWeight: "800", textTransform: "uppercase", color: "var(--muted)" }}>Category</th>
                    <th style={{ padding: "16px", textAlign: "left", fontSize: "11px", fontWeight: "800", textTransform: "uppercase", color: "var(--muted)" }}>Price</th>
                    <th style={{ padding: "16px", textAlign: "left", fontSize: "11px", fontWeight: "800", textTransform: "uppercase", color: "var(--muted)" }}>Stock Inventory</th>
                    <th style={{ padding: "16px", textAlign: "left", fontSize: "11px", fontWeight: "800", textTransform: "uppercase", color: "var(--muted)" }}>Visibility</th>
                    <th style={{ padding: "16px", textAlign: "right" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.slice((page-1)*10,page*10).map(p=>(
                    <tr key={p.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "16px" }}>
                        <div className="product-admin-cell" style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                          <img src={p.image_url} alt="" style={{ width: "36px", height: "36px", borderRadius: "var(--radius-sm)", objectFit: "cover", background: "var(--secondary)" }} />
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <strong style={{ fontSize: "13px", color: "var(--foreground)" }}>{p.name}</strong>
                            <small style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase" }}>{p.badge}</small>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "16px", fontSize: "13px", color: "var(--muted)" }}>{p.categories?.name??"—"}</td>
                      <td style={{ padding: "16px", fontSize: "13px", fontWeight: "750", color: "var(--foreground)" }}>₦{Number(p.price).toLocaleString()}</td>
                      
                      {/* Interactive Stock Inventory Adjuster */}
                      <td style={{ padding: "16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <button 
                            onClick={() => adjustProductStock(p.id, p.inventory, -5)}
                            style={{ width: "20px", height: "20px", borderRadius: "3px", border: "1px solid var(--border)", background: "var(--secondary)", color: "var(--muted)", fontSize: "10px", display: "grid", placeItems: "center" }}
                            title="Subtract 5 stock"
                          >
                            -5
                          </button>
                          <span 
                            style={{ 
                              fontSize: "13px", 
                              fontWeight: "750", 
                              minWidth: "24px", 
                              textAlign: "center", 
                              color: p.inventory < 10 ? "var(--danger)" : "var(--foreground)" 
                            }}
                          >
                            {p.inventory}
                          </span>
                          <button 
                            onClick={() => adjustProductStock(p.id, p.inventory, 5)}
                            style={{ width: "20px", height: "20px", borderRadius: "3px", border: "1px solid var(--border)", background: "var(--secondary)", color: "var(--muted)", fontSize: "10px", display: "grid", placeItems: "center" }}
                            title="Add 5 stock"
                          >
                            +5
                          </button>
                        </div>
                      </td>

                      {/* Interactive Visibility Toggle Button */}
                      <td style={{ padding: "16px" }}>
                        <button 
                          onClick={() => toggleProductActive(p.id, p.is_active)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: p.is_active ? "var(--primary)" : "var(--muted-light)" }}
                        >
                          {p.is_active ? <ToggleRight size={26} /> : <ToggleLeft size={26} />}
                        </button>
                      </td>

                      <td style={{ padding: "16px", textAlign: "right" }}>
                        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                          <button 
                            onClick={()=>setEditing(p)}
                            style={{ padding: "6px 12px", background: "var(--secondary)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: "12px", fontWeight: "700" }}
                          >
                            Edit
                          </button>
                          <button 
                            onClick={()=>removeProduct(p.id)}
                            style={{ padding: "6px", background: "var(--danger-light)", color: "var(--danger)", border: "none", borderRadius: "var(--radius-sm)" }}
                            aria-label="Delete product"
                          >
                            <Trash2 size={14}/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination page={page} total={filteredProducts.length} pageSize={10} change={setPage}/>
            </div>
            </>
          )}

          {tab==="Customers" && (
            <div className="admin-table-wrap" style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden", marginTop: "24px" }}>
              <table className="admin-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--secondary)", borderBottom: "1px solid var(--border)" }}>
                    <th style={{ padding: "16px", textAlign: "left", fontSize: "11px", fontWeight: "800", textTransform: "uppercase", color: "var(--muted)" }}>Customer Name</th>
                    <th style={{ padding: "16px", textAlign: "left", fontSize: "11px", fontWeight: "800", textTransform: "uppercase", color: "var(--muted)" }}>Email address</th>
                    <th style={{ padding: "16px", textAlign: "left", fontSize: "11px", fontWeight: "800", textTransform: "uppercase", color: "var(--muted)" }}>Account Role</th>
                    <th style={{ padding: "16px", textAlign: "left", fontSize: "11px", fontWeight: "800", textTransform: "uppercase", color: "var(--muted)" }}>Date Joined</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.slice((page-1)*10,page*10).map(c=>(
                    <tr key={c.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "16px", fontSize: "13px" }}>
                        <strong>{c.full_name||c.email?.split("@")[0]||"Customer"}</strong>
                      </td>
                      <td style={{ padding: "16px", fontSize: "13px", color: "var(--muted)" }}>{c.email || "—"}</td>
                      <td style={{ padding: "16px" }}>
                        <span className="role-pill" style={{ textTransform: "uppercase" }}>{c.role}</span>
                      </td>
                      <td style={{ padding: "16px", fontSize: "13px", color: "var(--muted)" }}>{new Date(c.created_at).toLocaleDateString()}</td><td><button className="banner-edit-action" onClick={()=>setAdministrator(c.id,true)}>Make admin</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination page={page} total={customers.length} pageSize={10} change={setPage}/>
            </div>
          )}

          {tab==="Administrators"&&<div className="admin-table-wrap" style={{marginTop:24}}><table className="admin-table"><thead><tr><th>Administrator</th><th>Email</th><th>Joined</th><th>Access</th></tr></thead><tbody>{administrators.slice((page-1)*10,page*10).map(person=><tr key={person.id}><td><strong>{person.full_name||"Administrator"}</strong></td><td>{person.email||"—"}</td><td>{new Date(person.created_at).toLocaleDateString()}</td><td><button className="banner-edit-action" onClick={()=>setAdministrator(person.id,false)}>Remove admin</button></td></tr>)}</tbody></table><Pagination page={page} total={administrators.length} pageSize={10} change={setPage}/></div>}

          {tab==="Audit Logs"&&<div className="admin-table-wrap" style={{marginTop:24}}><table className="admin-table"><thead><tr><th>Action</th><th>Entity</th><th>Actor</th><th>Date</th></tr></thead><tbody>{auditLogs.slice((page-1)*15,page*15).map(log=><tr key={log.id}><td><strong>{log.action}</strong></td><td>{log.entity_type}{log.entity_id?` · ${log.entity_id}`:""}</td><td>{log.actor_id}</td><td>{new Date(log.created_at).toLocaleString()}</td></tr>)}</tbody></table><Pagination page={page} total={auditLogs.length} pageSize={15} change={setPage}/></div>}

          {tab==="Categories" && (
            <div className="category-admin" style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "24px", marginTop: "24px" }}>
              <form onSubmit={addCategory} style={{ background: "var(--card-bg)", border: "1px solid var(--border)", padding: "20px", borderRadius: "var(--radius-lg)", display: "flex", flexDirection: "column", gap: "14px" }}>
                <h3>Add new category</h3>
                <input 
                  value={categoryName} 
                  onChange={e=>setCategoryName(e.target.value)} 
                  placeholder="e.g. Home Appliances" 
                  required minLength={2} maxLength={60} pattern="[A-Za-z0-9&' -]{2,60}" title="Use 2 to 60 letters, numbers, spaces, ampersands, apostrophes or hyphens."
                  style={{ height: "44px", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "0 12px", fontSize: "13px", background: "var(--card-bg)" }}
                />
                <button style={{ height: "44px", background: "var(--primary)", color: "#ffffff", borderRadius: "var(--radius-md)", fontWeight: "750", fontSize: "13px" }}>Create category</button>
              </form>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", height: "fit-content" }}>
                {categories.map(c=>(
                  <article key={c.id} style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "16px", display: "flex", alignItems: "center", gap: "14px" }}>
                    <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "var(--secondary)", color: "var(--primary)", display: "grid", placeItems: "center" }}>
                      <Tags size={16} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <strong style={{ display: "block", fontSize: "14px" }}>{c.name}</strong>
                      <small style={{ color: "var(--muted)", fontSize: "11px" }}>{products.filter(p=>p.category_id===c.id).length} products</small>
                    </div>
                    <button 
                      onClick={()=>deleteCategory(c.id)}
                      style={{ padding: "6px", background: "var(--danger-light)", color: "var(--danger)", border: "none", borderRadius: "var(--radius-sm)" }}
                      title="Delete category"
                    >
                      <Trash2 size={14}/>
                    </button>
                  </article>
                ))}
              </div>
            </div>
          )}

          {tab==="Analytics" && (
            <>
              <section className="stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", margin: "24px 0" }}>
                <Stat icon={CircleDollarSign} label="Total Volume" value={`₦${revenue.toLocaleString()}`} trend="Live sales volume" trendUp={true} />
                <Stat icon={ShoppingCart} label="Basket Average" value={`₦${avg.toLocaleString()}`} trend="Averaged over all orders" trendUp={true} />
                <Stat icon={Package} label="Units Dispatched" value={orders.reduce((s,o)=>s+(o.order_items?.reduce((n:number,i:any)=>n+i.quantity,0)??0),0)} trend="Gross units purchased" trendUp={true} />
                <Stat icon={Users} label="Newsletter Reach" value={subscribers.length} trend="Total subscribers" trendUp={true} />
              </section>

              <div className="panel analytics-panel" style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "24px" }}>
                <PanelTitle title="Sales activity history" sub="Completed and active checkout values in the database" />
                <div className="chart large" style={{ display: "flex", alignItems: "flex-end", height: "240px", gap: "4px", marginTop: "24px", paddingBottom: "10px", borderBottom: "1px solid var(--border)" }}>
                  {orders.map(o=>(
                    <div className="bar-wrap" key={o.id} style={{ flex: 1, height: "100%", display: "flex", alignItems: "flex-end" }} title={`${o.order_number}: ₦${o.total.toLocaleString()}`}>
                      <div 
                        className="bar" 
                        style={{ 
                          width: "100%",
                          height: `${Math.max(5, Number(o.total)/(Math.max(...orders.map(x=>Number(x.total)),1))*100)}%`,
                          background: "var(--primary)",
                          borderRadius: "1px 1px 0 0"
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {tab==="Marketing" && (
            <div className="marketing-admin" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              {!commerceTablesReady&&<div className="database-warning" role="alert"><AlertCircle/><div><strong>Commerce database upgrade required</strong><span>The live Supabase project is missing the banners or product-images table. Run <code>supabase/upgrade-live-commerce.sql</code> once in the Supabase SQL Editor, then reload this page.</span></div></div>}
              <div className="marketing-toolbar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h2 style={{ fontSize: "18px", fontWeight: 800 }}>Banner & campaigns</h2>
                  <p style={{ fontSize: "12px", color: "var(--muted)" }}>Control storefront promotions dynamically without changes to code.</p>
                </div>
                <button 
                  className="primary-action" 
                  onClick={()=>setEditingBanner({placement:"hero",badge:"",title:"",accent_text:"",subtitle:"",image_url:"",cta_label:"Shop now",cta_link:"#deals",background_color:"#eef6f2",sort_order:0,is_active:true})}
                  style={{ display: "flex", gap: "8px", alignItems: "center" }}
                >
                  <Plus size={16}/> Add campaign banner
                </button>
              </div>

              <div className="banner-admin-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                {banners.map(b=>(
                  <article key={b.id} style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                    <img src={b.image_url} alt="" style={{ height: "160px", width: "100%", objectFit: "cover" }} />
                    <div style={{ padding: "20px", flex: 1 }}>
                      <span style={{ fontSize: "10px", textTransform: "uppercase", fontWeight: "800", color: "var(--primary)", background: "var(--secondary)", padding: "3px 6px", borderRadius: "3px" }}>
                        {b.placement.replace("_"," ")}
                      </span>
                      <h3 style={{ fontSize: "16px", fontWeight: "800", marginTop: "10px" }}>{b.title} <span style={{ color: "var(--primary)" }}>{b.accent_text}</span></h3>
                      <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "6px", lineClamp: 2 }}>{b.subtitle}</p>
                      <span style={{ display: "inline-block", marginTop: "12px", fontSize: "11px", fontWeight: "750", color: b.is_active ? "var(--success)" : "var(--muted)" }}>
                        {b.is_active ? "🟢 Active Campaign" : "⚪ Draft Mode"}
                      </span>
                    </div>
                    <footer style={{ borderTop: "1px solid var(--border)", padding: "12px 20px", display: "flex", gap: "10px", background: "var(--secondary)" }}>
                      <button className="banner-edit-action" onClick={()=>setEditingBanner(b)}><Edit3 size={14}/> Edit banner</button>
                      <button onClick={()=>deleteBanner(b.id)} style={{ padding: "6px 12px", background: "var(--danger-light)", color: "var(--danger)", border: "none", borderRadius: "var(--radius-sm)", fontSize: "12px", fontWeight: "700", marginLeft: "auto" }}>Delete</button>
                    </footer>
                  </article>
                ))}
              </div>

              <div className="panel subscribers-panel" style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "24px" }}>
                <PanelTitle title="Newsletter reach list" sub="People registered to receive news and offer coupon validation codes" />
                <div className="subscriber-list" style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "20px" }}>
                  {subscribers.length ? subscribers.map(s=>(
                    <div key={s.id} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", padding: "8px 0", fontSize: "12px" }}>
                      <strong>{s.email}</strong>
                      <span style={{ color: "var(--muted)" }}>Registered {new Date(s.created_at).toLocaleDateString()}</span>
                    </div>
                  )) : <p style={{ fontSize: "13px", color: "var(--muted)" }}>No mailing subscribers yet.</p>}
                </div>
              </div>
            </div>
          )}

          {tab==="Settings" && (
            <form className="panel settings-form" onSubmit={saveSettings} style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "32px", display: "flex", flexDirection: "column", gap: "20px" }}>
              <PanelTitle title="Store content & settings" sub="Configure parameters displayed publicly on the storefront" />
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", fontWeight: 700 }}>
                  Store name
                  <input value={storeSettings.store_name||""} onChange={e=>setStoreSettings({...storeSettings,store_name:e.target.value})} required minLength={2} maxLength={100} style={{ height: "40px", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "0 12px", fontSize: "13px", background: "var(--card-bg)" }} />
                </label>
                
                <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", fontWeight: 700 }}>
                  Support email
                  <input type="email" value={storeSettings.support_email||""} onChange={e=>setStoreSettings({...storeSettings,support_email:e.target.value})} required maxLength={254} style={{ height: "40px", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "0 12px", fontSize: "13px", background: "var(--card-bg)" }} />
                </label>
                
                <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", fontWeight: 700 }}>
                  Support phone
                  <input type="tel" inputMode="tel" value={storeSettings.support_phone||""} onChange={e=>setStoreSettings({...storeSettings,support_phone:e.target.value})} required minLength={11} maxLength={18} pattern="(?:\\+234|0)(?:7[0-9]|8[0-9]|9[0-1])[0-9 ()-]{8,14}" title="Enter a valid Nigerian phone number." style={{ height: "40px", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "0 12px", fontSize: "13px", background: "var(--card-bg)" }} />
                </label>
                
                <label>Standard delivery fee (NGN)<input type="number" min="0" step="1" value={storeSettings.standard_shipping_fee||0} onChange={e=>setStoreSettings({...storeSettings,standard_shipping_fee:Number(e.target.value)})} required /></label>
                <label>Pickup fee (NGN)<input type="number" min="0" step="1" value={storeSettings.pickup_shipping_fee||0} onChange={e=>setStoreSettings({...storeSettings,pickup_shipping_fee:Number(e.target.value)})} required /></label>
              </div>

              <hr style={{ border: 0, borderTop: "1px solid var(--border)" }} />
              
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", fontWeight: 700 }}>
                  Top banner announcement — Left segment
                  <input value={storeSettings.announcement_left||""} onChange={e=>setStoreSettings({...storeSettings,announcement_left:e.target.value})} style={{ height: "40px", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "0 12px", fontSize: "13px", background: "var(--card-bg)" }} />
                </label>
                
                <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", fontWeight: 700 }}>
                  Top banner announcement — Centre segment
                  <input value={storeSettings.announcement_center||""} onChange={e=>setStoreSettings({...storeSettings,announcement_center:e.target.value})} style={{ height: "40px", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "0 12px", fontSize: "13px", background: "var(--card-bg)" }} />
                </label>
                
                <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", fontWeight: 700 }}>
                  Top banner announcement — Right segment
                  <input value={storeSettings.announcement_right||""} onChange={e=>setStoreSettings({...storeSettings,announcement_right:e.target.value})} style={{ height: "40px", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "0 12px", fontSize: "13px", background: "var(--card-bg)" }} />
                </label>
              </div>

              <hr style={{ border: 0, borderTop: "1px solid var(--border)" }} />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", fontWeight: 700 }}>
                  Flash-sale campaign title
                  <input value={storeSettings.flash_sale_title||""} onChange={e=>setStoreSettings({...storeSettings,flash_sale_title:e.target.value})} style={{ height: "40px", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "0 12px", fontSize: "13px", background: "var(--card-bg)" }} />
                </label>
                
                <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", fontWeight: 700 }}>
                  Flash-sale countdown end time
                  <input type="datetime-local" value={storeSettings.flash_sale_ends_at?String(storeSettings.flash_sale_ends_at).slice(0,16):""} onChange={e=>setStoreSettings({...storeSettings,flash_sale_ends_at:e.target.value?new Date(e.target.value).toISOString():null})} style={{ height: "40px", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "0 12px", fontSize: "13px", background: "var(--card-bg)" }} />
                </label>
              </div>

              <button style={{ height: "44px", background: "var(--primary)", color: "#ffffff", borderRadius: "var(--radius-md)", fontWeight: "750", fontSize: "14px", marginTop: "12px" }}>Save all storefront settings</button>
            </form>
          )}
        </>}
      </div>
    </main>

    {editing&&<ProductEditor item={editing} categories={categories} notice={notice} close={()=>setEditing(null)} submit={saveProduct} upload={uploadImage}/>}
    {editingBanner&&<BannerEditor item={editingBanner} close={()=>setEditingBanner(null)} submit={saveBanner} upload={uploadImage}/>}
    
    {/* Collapsible Order Detail Popup */}
    {selectedOrderDetails && (
      <div className="modal-overlay" role="presentation" onMouseDown={e => e.target === e.currentTarget && setSelectedOrderDetails(null)}>
        <div className="product-editor animate-scale-up" style={{ maxWidth: "560px", padding: "24px" }}>
          <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", paddingBottom: "12px", marginBottom: "16px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 800 }}>Order details</h2>
            <button onClick={() => setSelectedOrderDetails(null)} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={18} /></button>
          </header>

          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
            <div>
              <strong style={{ fontSize: "16px" }}>{selectedOrderDetails.order_number}</strong>
              <span style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>
                Created on {new Date(selectedOrderDetails.created_at).toLocaleString()}
              </span>
            </div>
            <div style={{ textAlign: "right" }}>
              <span className={`status ${selectedOrderDetails.status}`}>{selectedOrderDetails.status}</span>
              <strong style={{ display: "block", fontSize: "16px", color: "var(--primary)", marginTop: "4px" }}>
                ₦{selectedOrderDetails.total.toLocaleString()}
              </strong>
            </div>
          </div>

          <div style={{ background: "var(--secondary)", borderRadius: "var(--radius-md)", padding: "16px", marginBottom: "20px" }}>
            <h4 style={{ fontSize: "10px", textTransform: "uppercase", fontWeight: "800", color: "var(--muted)", letterSpacing: "0.08em", marginBottom: "8px" }}>Fulfillment status management</h4>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <select 
                value={selectedOrderDetails.status} 
                onChange={e => {
                  orderStatus(selectedOrderDetails.id, e.target.value);
                  setSelectedOrderDetails({ ...selectedOrderDetails, status: e.target.value });
                }}
                style={{
                  height: "36px",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  padding: "0 10px",
                  fontSize: "12px",
                  background: "var(--card-bg)",
                  flex: 1
                }}
              >
                {["pending","paid","processing","shipped","delivered","cancelled"].map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: "20px" }}>
            <h4 style={{ fontSize: "10px", textTransform: "uppercase", fontWeight: "800", color: "var(--muted)", letterSpacing: "0.08em", marginBottom: "8px" }}>Shipping address</h4>
            <div style={{ fontSize: "12px", color: "var(--foreground)", lineHeight: "1.5" }}>
              <strong>{selectedOrderDetails.shipping_address?.first_name} {selectedOrderDetails.shipping_address?.last_name}</strong>
              <span style={{ display: "block" }}>{selectedOrderDetails.shipping_address?.line1}</span>
              <span style={{ display: "block" }}>{selectedOrderDetails.shipping_address?.city}, {selectedOrderDetails.shipping_address?.state}</span>
              <span style={{ display: "block" }}>Phone: {selectedOrderDetails.shipping_address?.phone}</span>
              {selectedOrderDetails.shipping_address?.delivery_method && (
                <span style={{ display: "block", marginTop: "4px" }}>Delivery method: <strong style={{ textTransform: "capitalize" }}>{selectedOrderDetails.shipping_address?.delivery_method}</strong></span>
              )}
            </div>
          </div>

          <div>
            <h4 style={{ fontSize: "10px", textTransform: "uppercase", fontWeight: "800", color: "var(--muted)", letterSpacing: "0.08em", marginBottom: "8px" }}>Ordered items</h4>
            <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
              {selectedOrderDetails.order_items?.map((item: any, index: number) => (
                <div key={index} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderBottom: index < selectedOrderDetails.order_items.length - 1 ? "1px solid var(--border)" : "none", fontSize: "12px" }}>
                  <span>{item.product_name}{item.selected_variant?.options?<small style={{display:"block",color:"var(--muted)",marginTop:3}}>{Object.entries(item.selected_variant.options).map(([key,value])=>`${key}: ${value}`).join(" · ")}</small>:null} <strong>× {item.quantity}</strong></span>
                  <strong>₦{(item.unit_price * item.quantity).toLocaleString()}</strong>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px", borderTop: "1px solid var(--border)", paddingTop: "16px" }}>
            <button 
              onClick={() => setSelectedOrderDetails(null)}
              style={{
                height: "36px",
                padding: "0 16px",
                border: "1px solid var(--border)",
                background: "var(--card-bg)",
                borderRadius: "var(--radius-sm)",
                fontSize: "12px",
                fontWeight: "700"
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )}
  </div>;
}

function Stat({icon:Icon,label,value,trend,trendUp}:{icon:any;label:string;value:any;trend:string;trendUp:boolean}){
  return <div className="stat-card" style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
    <div className="stat-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span className="stat-icon green" style={{ width: "32px", height: "32px", borderRadius: "50%", background: "var(--secondary)", color: "var(--primary)", display: "grid", placeItems: "center" }}><Icon size={16}/></span>
      <span 
        style={{ 
          fontSize: "11px", 
          fontWeight: "800", 
          color: trendUp ? "var(--success)" : "var(--danger)",
          display: "flex",
          alignItems: "center",
          gap: "2px"
        }}
      >
        {trendUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
        {trend}
      </span>
    </div>
    <div>
      <p style={{ fontSize: "12px", color: "var(--muted)", fontWeight: "600" }}>{label}</p>
      <strong style={{ fontSize: "20px", fontWeight: "900", color: "var(--foreground)", marginTop: "4px", display: "block" }}>{value}</strong>
    </div>
  </div>
}

function PanelTitle({title,sub}:{title:string;sub:string}){
  return <div className="panel-heading">
    <div>
      <h2 style={{ fontSize: "16px", fontWeight: "800" }}>{title}</h2>
      <p style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>{sub}</p>
    </div>
  </div>
}

function Pagination({page,total,pageSize,change}:{page:number;total:number;pageSize:number;change:(page:number)=>void}){const pages=Math.max(1,Math.ceil(total/pageSize));return <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 16px",borderTop:"1px solid var(--border)",fontSize:12,color:"var(--muted)"}}><span>{total?`${(page-1)*pageSize+1}–${Math.min(page*pageSize,total)} of ${total}`:"No records"}</span><div style={{display:"flex",gap:8}}><button disabled={page<=1} onClick={()=>change(page-1)} style={{padding:"7px 12px",border:"1px solid var(--border)",borderRadius:8}}>Previous</button><button disabled={page>=pages} onClick={()=>change(page+1)} style={{padding:"7px 12px",border:"1px solid var(--border)",borderRadius:8}}>Next</button></div></div>}

function OrdersTable({orders,change,onViewDetails}:{orders:any[];change:(id:string,s:string)=>void;onViewDetails:(order:any)=>void}){
  const [page,setPage]=useState(1),visible=orders.slice((page-1)*10,page*10);
  return <div className="panel table-panel" style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "24px", marginTop: "24px" }}>
    <PanelTitle title="All customer orders" sub="Track payments, adjust fulfillment pipelines, and access receipts" />
    <div className="admin-table-scroll" style={{ overflowX: "auto", marginTop: "20px" }}>
      <table className="orders-table" style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "11px", fontWeight: "800", textTransform: "uppercase", color: "var(--muted)" }}>Order</th>
            <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "11px", fontWeight: "800", textTransform: "uppercase", color: "var(--muted)" }}>Items</th>
            <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "11px", fontWeight: "800", textTransform: "uppercase", color: "var(--muted)" }}>Total Value</th>
            <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "11px", fontWeight: "800", textTransform: "uppercase", color: "var(--muted)" }}>Fulfillment status</th>
            <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "11px", fontWeight: "800", textTransform: "uppercase", color: "var(--muted)" }}>Date</th>
            <th style={{ padding: "12px 16px", textAlign: "right" }}></th>
          </tr>
        </thead>
        <tbody>
          {visible.map(o=>(
            <tr key={o.id} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={{ padding: "16px" }}>
                <strong style={{ fontSize: "13px" }}>{o.order_number}</strong>
              </td>
              <td style={{ padding: "16px", fontSize: "12px", color: "var(--muted)", maxWidth: "240px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {o.order_items?.map((i:any)=>`${i.product_name}${i.selected_variant?.options?` (${Object.values(i.selected_variant.options).join(" / ")})`:""} ×${i.quantity}`).join(", ")}
              </td>
              <td style={{ padding: "16px", fontSize: "13px", fontWeight: "750" }}>₦{Number(o.total).toLocaleString()}</td>
              <td style={{ padding: "16px" }}>
                <select 
                  value={o.status} 
                  onChange={e=>change(o.id,e.target.value)}
                  style={{
                    height: "30px",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                    padding: "0 6px",
                    fontSize: "12px",
                    background: "var(--secondary)",
                    color: "var(--foreground)",
                    cursor: "pointer"
                  }}
                >
                  {["pending","paid","processing","shipped","delivered","cancelled"].map(s=><option key={s}>{s}</option>)}
                </select>
              </td>
              <td style={{ padding: "16px", fontSize: "13px", color: "var(--muted)" }}>{new Date(o.created_at).toLocaleDateString()}</td>
              <td style={{ padding: "16px", textAlign: "right" }}>
                <button 
                  onClick={() => onViewDetails(o)}
                  style={{
                    padding: "6px 12px",
                    border: "1px solid var(--border)",
                    background: "var(--secondary)",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "11px",
                    fontWeight: "750",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px"
                  }}
                >
                  <Eye size={12} /> View Details
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <Pagination page={page} total={orders.length} pageSize={10} change={setPage}/>
  </div>
}

function ProductEditor({item,categories,notice,close,submit,upload}:{item:any;categories:any[];notice:string;close:()=>void;submit:(e:React.FormEvent<HTMLFormElement>)=>void;upload:(f:File,set:(u:string)=>void)=>void}){
  const [gallery,setGallery]=useState<string[]>(item.product_images?.sort((a:any,b:any)=>a.sort_order-b.sort_order).map((i:any)=>i.image_url)??(item.image_url?[item.image_url]:[]));
  const [variants,setVariants]=useState<any[]>(Array.isArray(item.variants)?item.variants:[]);
  const [variantAttributes,setVariantAttributes]=useState<string[]>(()=>Array.from(new Set((Array.isArray(item.variants)?item.variants:[]).flatMap((variant:any)=>Object.keys(variant.options||{})))) as string[]);
  const [variantValueDrafts,setVariantValueDrafts]=useState<Record<string,string>>(()=>{
    const rows=Array.isArray(item.variants)?item.variants:[];
    const names=Array.from(new Set(rows.flatMap((variant:any)=>Object.keys(variant.options||{})))) as string[];
    return Object.fromEntries(names.map(name=>[name,Array.from(new Set(rows.map((variant:any)=>variant.options?.[name]).filter(Boolean))).join(", ")]));
  });
  const [newAttribute,setNewAttribute]=useState("");
  const fixedSpecificationNames=["Brand","Shipping Weight (kg)","Short Description","Product Type","Return Policy","Bulk Price","Colour","Gender","Condition"];
  const sourceSpecifications=(()=>{try{const value=typeof item.specifications==="string"?JSON.parse(item.specifications):item.specifications;return value&&typeof value==="object"&&!Array.isArray(value)?value:{}}catch{return {}}})();
  const [productDetails,setProductDetails]=useState<Record<string,string>>({
    Brand:String(sourceSpecifications.Brand||""),
    "Shipping Weight (kg)":String(sourceSpecifications["Shipping Weight (kg)"]||""),
    "Short Description":String(sourceSpecifications["Short Description"]||""),
    "Product Type":String(sourceSpecifications["Product Type"]||""),
    "Return Policy":String(sourceSpecifications["Return Policy"]||"7 Days"),
    "Bulk Price":String(sourceSpecifications["Bulk Price"]||""),
    Colour:String(sourceSpecifications.Colour||""),
    Gender:String(sourceSpecifications.Gender||""),
    Condition:String(sourceSpecifications.Condition||"New")
  });
  const [selectedCategory,setSelectedCategory]=useState(String(item.category_id||""));
  const [hasWarranty,setHasWarranty]=useState(Boolean(Number(item.warranty_value||0)>0||item.warranty_notes));
  const [validationMessage,setValidationMessage]=useState("");
  const [specifications,setSpecifications]=useState<{name:string;value:string}[]>(Object.entries(sourceSpecifications).filter(([name])=>!fixedSpecificationNames.includes(name)).map(([name,value])=>({name,value:String(value)})));
  const addVariant=()=>setVariants(current=>[...current,{id:crypto.randomUUID(),options:Object.fromEntries(variantAttributes.map(name=>[name,""])),sku:"",price:"",discounted_price:"",inventory:0,image_url:""}]);
  const setPreset=(type:"fashion"|"shoes"|"phone"|"watch")=>{
    const presets={
      fashion:{attributes:["Size","Colour"],rows:["S","M","L","XL"].flatMap(Size=>["Black","White"].map(Colour=>({Size,Colour}))),prefix:"FAS"},
      shoes:{attributes:["Shoe Size","Colour"],rows:["39","40","41","42","43","44"].flatMap(size=>["Black","Brown"].map(Colour=>({"Shoe Size":size,Colour}))),prefix:"SHO"},
      phone:{attributes:["Storage","Colour"],rows:["128 GB","256 GB","512 GB"].flatMap(Storage=>["Black","Blue","White"].map(Colour=>({Storage,Colour}))),prefix:"PHN"},
      watch:{attributes:["Case Size","Strap Material","Colour"],rows:["40 mm","44 mm"].flatMap(size=>["Silicone","Leather"].map(material=>({"Case Size":size,"Strap Material":material,Colour:"Black"}))),prefix:"WAT"}
    },preset=presets[type];
    setVariantAttributes(preset.attributes);
    setVariantValueDrafts(Object.fromEntries(preset.attributes.map(attribute=>[attribute,Array.from(new Set(preset.rows.map((row:any)=>row[attribute]).filter(Boolean))).join(", ")])));
    setVariants(preset.rows.map((options,index)=>({id:crypto.randomUUID(),options,sku:`${preset.prefix}-${String(index+1).padStart(2,"0")}`,price:"",inventory:0,image_url:""})));
  };
  const addAttribute=()=>{
    const name=newAttribute.trim().replace(/\s+/g," ");
    if(!name||variantAttributes.some(attribute=>attribute.toLowerCase()===name.toLowerCase()))return;
    setVariantAttributes(current=>[...current,name]);
    setVariantValueDrafts(current=>({...current,[name]:""}));
    setVariants(current=>current.map(variant=>({...variant,options:{...variant.options,[name]:""}})));
    setNewAttribute("");
  };
  const renameAttribute=(oldName:string,nextValue:string)=>{
    const nextName=nextValue.trim().replace(/\s+/g," ");
    if(!nextName||nextName===oldName||variantAttributes.some(name=>name!==oldName&&name.toLowerCase()===nextName.toLowerCase()))return;
    setVariantAttributes(current=>current.map(name=>name===oldName?nextName:name));
    setVariantValueDrafts(current=>{const next={...current,[nextName]:current[oldName]??""};delete next[oldName];return next});
    setVariants(current=>current.map(variant=>{const options={...variant.options};options[nextName]=options[oldName]??"";delete options[oldName];return {...variant,options}}));
  };
  const removeAttribute=(name:string)=>{
    setVariantAttributes(current=>current.filter(attribute=>attribute!==name));
    setVariantValueDrafts(current=>{const next={...current};delete next[name];return next});
    setVariants(current=>current.map(variant=>{const options={...variant.options};delete options[name];return {...variant,options}}));
  };
  const updateVariant=(index:number,key:string,value:any)=>setVariants(current=>current.map((variant,i)=>i===index?key.startsWith("option.")?{...variant,options:{...variant.options,[key.slice(7)]:value}}:{...variant,[key]:value}:variant));
  const generateVariantMatrix=()=>{
    const groups=variantAttributes.map(name=>({name,values:Array.from(new Set((variantValueDrafts[name]||"").split(",").map(value=>value.trim()).filter(Boolean)))}));
    if(!groups.length||groups.some(group=>!group.values.length))return;
    const combinations=groups.reduce<Record<string,string>[]>((rows,group)=>rows.flatMap(row=>group.values.map(value=>({...row,[group.name]:value}))),[{}]);
    if(combinations.length>100)return;
    const existing=new Map(variants.map(variant=>[Object.entries(variant.options||{}).sort(([a],[b])=>a.localeCompare(b)).map(([name,value])=>`${name}:${value}`).join("|"),variant]));
    setVariants(combinations.map((options,index)=>{
      const signature=Object.entries(options).sort(([a],[b])=>a.localeCompare(b)).map(([name,value])=>`${name}:${value}`).join("|");
      return existing.get(signature)??{id:crypto.randomUUID(),options,sku:`TAI-${String(index+1).padStart(3,"0")}`,price:"",discounted_price:"",inventory:0,image_url:""};
    }));
  };
  const uploadMany=async(files:FileList|null)=>{
    if(!files) return;
    const added:string[]=[];
    for(const file of Array.from(files)){
      await upload(file,(url)=>added.push(url));
    }
    setGallery(current=>[...current,...added].slice(0,10));
  };
  
  return <div className="modal-overlay">
    <form className="product-editor animate-scale-up" noValidate onInvalid={event=>event.preventDefault()} onSubmit={event=>{
      if(!event.currentTarget.checkValidity()){
        event.preventDefault();
        const invalid=event.currentTarget.querySelector<HTMLElement>(":invalid");
        const label=invalid?.closest("label")?.childNodes[0]?.textContent?.trim()||"A required field";
        setValidationMessage(`${label} needs your attention before this product can be saved.`);
        invalid?.scrollIntoView({behavior:"smooth",block:"center"});
        window.setTimeout(()=>invalid?.focus(),250);
        return;
      }
      setValidationMessage("");
      submit(event);
    }}>
      <input type="hidden" name="gallery_urls" value={JSON.stringify(gallery)}/>
      <input type="hidden" name="variants" value={JSON.stringify(variants.map(variant=>({...variant,options:Object.fromEntries(Object.entries(variant.options||{}).filter(([,value])=>String(value).trim()))})))}/>
      <input type="hidden" name="specifications" value={JSON.stringify({...Object.fromEntries(specifications.filter(spec=>spec.name.trim()&&spec.value.trim()).map(spec=>[spec.name.trim(),spec.value.trim()])),...Object.fromEntries(Object.entries(productDetails).filter(([,value])=>value.trim()))})}/>
      <header>
        <div><span className="editor-eyebrow">Catalogue / {item.id?"Edit product":"New product"}</span><h2>{item.id?"Edit product":"Add product"}</h2></div>
        <button type="button" onClick={close}><X/></button>
      </header>
      <div className="product-editor-steps" aria-label="Product setup sections">
        <span><b>1</b> Product details</span><span><b>2</b> Media & policies</span><span><b>3</b> Variants & stock</span><span><b>4</b> Publish</span>
      </div>
      {(validationMessage||notice)&&<div className="product-form-error" role="alert"><AlertCircle/><span><b>Product not ready to save</b><small>{validationMessage||notice}</small></span><button type="button" onClick={()=>setValidationMessage("")} aria-label="Dismiss validation message"><X/></button></div>}
      <div className="editor-grid">
        <section className="full konga-form-section">
          <div className="konga-section-heading"><strong>Product category</strong><small>Choose the closest category and product type.</small></div>
          <div className="konga-two-column">
            <label>Main category <span className="required">*</span>
              <select name="category_id" value={selectedCategory} onChange={e=>setSelectedCategory(e.target.value)} required>
                <option value="">Select one</option>
                {categories.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label>Sub category / product type <span className="required">*</span>
              <select value={productDetails["Product Type"]} onChange={e=>setProductDetails(current=>({...current,"Product Type":e.target.value}))} required>
                <option value="">Select one</option>
                {["Accessories","Beauty & personal care","Clothing","Computers","Electronics","Footwear","Food & grocery","Home & kitchen","Mobile phones","Sports & fitness","Other"].map(value=><option key={value}>{value}</option>)}
              </select>
            </label>
          </div>
          {selectedCategory&&productDetails["Product Type"]&&<div className="category-complete"><CheckCircle2 size={17}/> Maximum sub-category reached!</div>}
        </section>
        <section className="full konga-form-section">
          <div className="konga-section-heading"><strong>Product details</strong><small>Enter the factual information customers need to identify this item.</small></div>
          <div className="konga-two-column">
            <label>Brand <span className="required">*</span><small>For unbranded items, use the hyphen sign (-)</small>
              <input value={productDetails.Brand} onChange={e=>setProductDetails(current=>({...current,Brand:e.target.value}))} placeholder="What's the brand of the item?" required/>
            </label>
            <label>Shipping weight (kg) <span className="required">*</span>
              <input type="number" min=".01" step=".01" value={productDetails["Shipping Weight (kg)"]} onChange={e=>setProductDetails(current=>({...current,"Shipping Weight (kg)":e.target.value}))} placeholder="What's the weight of the item in kilograms?" required/>
            </label>
          </div>
        </section>
        <label className="full">Product title <span className="required">*</span> <small>Do not add the brand name here</small>
          <input name="name" defaultValue={item.name} required minLength={2} maxLength={120} onBlur={e=>{
            const slug=(e.currentTarget.form?.elements.namedItem("slug") as HTMLInputElement);
            if(slug&&!slug.value) slug.value=e.target.value.toLowerCase().replace(/[^a-z0-9]+/g,"-");
          }} placeholder="What's the name of the item?"/>
        </label>
        <label>Slug
          <input name="slug" defaultValue={item.slug} required minLength={2} maxLength={140} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" title="Use lowercase letters, numbers and single hyphens only."/>
        </label>
        <label>Price
          <input name="price" type="number" min="0.01" max="1000000000" step=".01" defaultValue={item.price} required/>
        </label>
        <label>Compare price
          <input name="compare_at_price" type="number" min="0.01" max="1000000000" step=".01" defaultValue={item.compare_at_price}/>
        </label>
        <label>Inventory
          {variants.length?<input name="inventory" type="number" min="0" max="10000000" step="1" value={variants.reduce((sum,variant)=>sum+Number(variant.inventory||0),0)} readOnly required/>:<input name="inventory" type="number" min="0" max="10000000" step="1" defaultValue={item.inventory} required/>}
          {variants.length>0&&<small>Calculated automatically from variant stock.</small>}
        </label>
        <label>Badge
          <input name="badge" defaultValue={item.badge} maxLength={30}/>
        </label>
        <label className="full">Description <span className="required">*</span>
          <textarea name="description" defaultValue={item.description} minLength={10} maxLength={3000} required placeholder="Describe the product, its features, materials and use"/>
        </label>
        <label className="full">Short description <span className="required">*</span>
          <small>Input product highlights/features in bullets. Not more than 200 characters. Characters: {productDetails["Short Description"].length}/200</small>
          <textarea value={productDetails["Short Description"]} onChange={e=>setProductDetails(current=>({...current,"Short Description":e.target.value.slice(0,200)}))} maxLength={200} required placeholder="• Key feature&#10;• Key benefit"/>
        </label>
        <section className="full product-policy-editor">
          <div className="policy-heading"><div><strong>Specifications</strong><small>Add factual details that apply to this product.</small></div><button type="button" onClick={()=>setSpecifications(current=>[...current,{name:"",value:""}])}>+ Add specification</button></div>
          {specifications.length===0?<div className="variant-empty">No specifications added yet.</div>:<div className="specification-rows">{specifications.map((spec,index)=><div key={index}><input value={spec.name} onChange={e=>setSpecifications(current=>current.map((row,i)=>i===index?{...row,name:e.target.value}:row))} placeholder="e.g. Material"/><input value={spec.value} onChange={e=>setSpecifications(current=>current.map((row,i)=>i===index?{...row,value:e.target.value}:row))} placeholder="e.g. 100% cotton"/><button type="button" onClick={()=>setSpecifications(current=>current.filter((_,i)=>i!==index))}><X/></button></div>)}</div>}
        </section>
        <section className="full product-policy-editor">
          <div className="policy-heading"><div><strong>Warranty options</strong><small>Warranty details appear only when “Yes” is selected.</small></div></div>
          <fieldset className="warranty-choice"><legend>Do you provide a warranty? <span className="required">*</span></legend><label><input type="radio" checked={!hasWarranty} onChange={()=>setHasWarranty(false)}/> No warranty</label><label><input type="radio" checked={hasWarranty} onChange={()=>setHasWarranty(true)}/> Yes</label></fieldset>
          {!hasWarranty?<><input type="hidden" name="warranty_value" value="0"/><input type="hidden" name="warranty_unit" value="months"/><input type="hidden" name="warranty_notes" value=""/></>:<div className="policy-grid"><label>Warranty duration <span className="required">*</span><input name="warranty_value" type="number" min="1" max="120" step="1" defaultValue={item.warranty_value||1} required/></label><label>Warranty period <span className="required">*</span><select name="warranty_unit" defaultValue={item.warranty_unit||"months"} required><option value="days">Days</option><option value="months">Months</option><option value="years">Years</option></select></label><label className="full">Warranty details <span className="required">*</span><textarea name="warranty_notes" maxLength={1000} defaultValue={item.warranty_notes||""} placeholder="Coverage, exclusions and how customers make a claim" required/></label></div>}
        </section>
        <section className="full konga-form-section">
          <div className="konga-section-heading"><strong>Other product options</strong><small>Set return, colour, gender and condition information.</small></div>
          <div className="konga-two-column">
            <label>Return policy<select value={productDetails["Return Policy"]} onChange={e=>setProductDetails(current=>({...current,"Return Policy":e.target.value}))}><option>7 Days</option><option>14 Days</option><option>30 Days</option><option>No Returns</option></select></label>
            <label>Bulk price<input type="number" min="0" step=".01" value={productDetails["Bulk Price"]} onChange={e=>setProductDetails(current=>({...current,"Bulk Price":e.target.value}))} placeholder="Optional"/></label>
            <label>Colour <span className="required">*</span><select value={productDetails.Colour} onChange={e=>setProductDetails(current=>({...current,Colour:e.target.value}))} required><option value="">Select one</option>{["Black","Blue","Brown","Gold","Green","Grey","Multi-colour","Orange","Pink","Purple","Red","Silver","White","Yellow","Not applicable"].map(value=><option key={value}>{value}</option>)}</select></label>
            <label>Gender <span className="required">*</span><select value={productDetails.Gender} onChange={e=>setProductDetails(current=>({...current,Gender:e.target.value}))} required><option value="">Select one</option><option>Female</option><option>Male</option><option>Unisex</option><option>Kids</option><option>Not applicable</option></select></label>
            <label>Condition <span className="required">*</span><select value={productDetails.Condition} onChange={e=>setProductDetails(current=>({...current,Condition:e.target.value}))} required><option>New</option><option>Refurbished</option><option>Drift</option><option>Preowned</option><option>Used - like new</option><option>Used - good</option></select></label>
          </div>
          {productDetails["Return Policy"]!=="No Returns"&&<div className="return-conditions"><PackageCheck/><div><strong>Return conditions applied to this product</strong><ul><li>Item must be unused, undamaged and resellable.</li><li>Original packaging, accessories, manuals and tags must be included.</li><li>Item must be returned within the selected return window.</li></ul><small>Used, damaged or tampered items do not qualify for a refund.</small></div></div>}
          <input type="hidden" name="returnable" value={productDetails["Return Policy"]==="No Returns"?"no":"yes"}/>
        </section>
        <section className="full image-upload product-image-uploader">
          <div className="image-uploader-heading"><div><strong>Product images <span className="required">*</span></strong><small>Recommended 500 × 500 px. Minimum 3 images, maximum 10; the first is primary.</small></div><span>{gallery.length} of 10 uploaded</span></div>
          <label className="device-upload-zone"><ImagePlus/><b>Drag and drop or click here to add images</b><small>Recommended 500 × 500 px · JPG, PNG or WebP · up to 8 MB each</small><input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={gallery.length>=10} onChange={e=>uploadMany(e.target.files)}/></label>
          {gallery.length>0&&gallery.length<3&&<div className="image-requirement">Add {3-gallery.length} more image{3-gallery.length===1?"":"s"} to continue.</div>}
          <div className="gallery-admin-preview">
            {gallery.map((url,index)=>(
              <figure key={`${url}-${index}`}>
                <img src={url} alt=""/>
                <button type="button" onClick={()=>setGallery(current=>current.filter((_,i)=>i!==index))}><X/></button>
                <small>{index===0?"Primary image":`Gallery ${index+1}`}</small>
                {index>0&&<button className="make-primary" type="button" onClick={()=>setGallery(current=>[current[index],...current.filter((_,i)=>i!==index)])}>Make primary</button>}
              </figure>
            ))}
          </div>
        </section>
        <section className="full variant-editor">
          <div className="variant-editor-heading"><div><strong>Variants & inventory</strong><small>Create option types for any product, then manage every sellable combination.</small></div><button type="button" onClick={addVariant} disabled={!variantAttributes.length}>+ Add combination</button></div>
          <div className="variant-presets"><span>Quick setup</span><button type="button" onClick={()=>setPreset("fashion")}>Clothing</button><button type="button" onClick={()=>setPreset("shoes")}>Shoes</button><button type="button" onClick={()=>setPreset("phone")}>Smartphones</button><button type="button" onClick={()=>setPreset("watch")}>Watches</button>{(variants.length>0||variantAttributes.length>0)&&<button className="clear" type="button" onClick={()=>{setVariants([]);setVariantAttributes([]);setVariantValueDrafts({})}}>Clear</button>}</div>
          <div className="variant-attribute-builder">
            <div><strong>Option types & values</strong><small>Add values separated by commas, then generate every sellable combination automatically.</small></div>
            <div className="variant-attribute-add"><input value={newAttribute} onChange={e=>setNewAttribute(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addAttribute()}}} maxLength={40} placeholder="Enter an option type"/><button type="button" onClick={addAttribute}>Add option</button></div>
            {variantAttributes.length>0&&<div className="variant-matrix-builder">{variantAttributes.map(attribute=><div className="variant-matrix-row" key={attribute}><div><input defaultValue={attribute} aria-label={`Rename ${attribute}`} onBlur={e=>renameAttribute(attribute,e.target.value)}/><button type="button" aria-label={`Remove ${attribute}`} onClick={()=>removeAttribute(attribute)}><X/></button></div><input value={variantValueDrafts[attribute]??""} onChange={e=>setVariantValueDrafts(current=>({...current,[attribute]:e.target.value}))} placeholder={attribute.toLowerCase().includes("size")?"S, M, L, XL":attribute.toLowerCase().includes("colour")?"Black, White, Blue":`Enter ${attribute.toLowerCase()} values`}/></div>)}
              <div className="variant-matrix-summary"><span><b>{variantAttributes.length}</b> option type{variantAttributes.length===1?"":"s"}</span><span><b>{variantAttributes.reduce((total,name)=>total*Math.max(1,(variantValueDrafts[name]||"").split(",").map(value=>value.trim()).filter(Boolean).length),1)}</b> possible combinations</span><button type="button" onClick={generateVariantMatrix}>Generate combinations</button></div>
            </div>}
          </div>
          {variants.length===0?<div className="variant-empty">No variants — customers will add this product directly.</div>:<div className="variant-list">{variants.map((variant,index)=><article key={variant.id}>
            <div className="variant-row-title"><div><b>{Object.values(variant.options||{}).filter(Boolean).join(" / ")||`Combination ${index+1}`}</b><small>Uses the shared product gallery · Variant {index+1}</small></div><button type="button" onClick={()=>setVariants(current=>current.filter((_,i)=>i!==index))}>Remove</button></div>
            <div className="variant-fields variant-combination-grid">
              {variantAttributes.map(attribute=>{const options=Array.from(new Set([...(variantValueDrafts[attribute]||"").split(",").map(value=>value.trim()).filter(Boolean),variant.options?.[attribute]].filter(Boolean)));return <label key={attribute}>{attribute} <span className="required">*</span><select value={variant.options?.[attribute]||""} onChange={e=>updateVariant(index,`option.${attribute}`,e.target.value)} required><option value="">Select one</option>{options.map(value=><option value={value} key={value}>{value}</option>)}</select></label>})}
              <label>SKU<input value={variant.sku||""} onChange={e=>updateVariant(index,"sku",e.target.value)} placeholder="TAI-BLK-128"/></label>
              <label>Quantity <span className="required">*</span><input type="number" min="0" step="1" value={variant.inventory??0} onChange={e=>updateVariant(index,"inventory",e.target.value)} required/></label>
              <label>Price <span className="required">*</span><input type="number" min="0.01" step=".01" value={variant.price??""} onChange={e=>updateVariant(index,"price",e.target.value)} placeholder={`Base: ₦${Number(item.price||0).toLocaleString()}`} required/></label>
              <label>Discounted price<input type="number" min="0.01" step=".01" value={variant.discounted_price??""} onChange={e=>updateVariant(index,"discounted_price",e.target.value)} placeholder="Optional"/></label>
              <label>Total price (inc VAT)<input value={`₦${Number(variant.discounted_price||variant.price||item.price||0).toLocaleString()}`} readOnly/></label>
            </div>
          </article>)}</div>}
          <button className="add-new-variant" type="button" onClick={addVariant} disabled={!variantAttributes.length}>Add new variant</button>
        </section>
        <label className="check"><input name="is_active" type="checkbox" defaultChecked={item.is_active}/> Active and visible</label>
      </div>
      <footer>
        <div className="save-readiness"><i><CheckCircle2 size={18}/></i><span><b>Product validation is active</b><small>Required details, images, pricing and variant stock are checked when you save.</small></span></div>
        <div className="editor-footer-actions">
          <button className="editor-cancel" type="button" onClick={close}>Cancel</button>
          <button className="editor-save" type="submit"><CheckCircle2 size={16}/> Save product</button>
        </div>
      </footer>
    </form>
  </div>
}

function BannerEditor({item,close,submit,upload}:{item:any;close:()=>void;submit:(e:React.FormEvent<HTMLFormElement>)=>void;upload:(f:File,set:(u:string)=>void)=>void}){
  const [images,setImages]=useState<string[]>(Array.isArray(item.image_urls)&&item.image_urls.length?item.image_urls:item.image_url?[item.image_url]:[]);
  const uploadMany=async(files:FileList|null)=>{if(!files)return;for(const file of Array.from(files)){await upload(file,(url)=>setImages(current=>[...current,url]))}};
  return <div className="modal-overlay">
    <form className="product-editor animate-scale-up" onSubmit={submit}>
      <input type="hidden" name="image_urls" value={JSON.stringify(images)}/>
      <header>
        <h2>{item.id?"Edit banner":"Add banner"}</h2>
        <button type="button" onClick={close}><X/></button>
      </header>
      <div className="editor-grid">
        <label>Placement
          <select name="placement" defaultValue={item.placement}>
            <option value="hero">Main hero</option>
            <option value="side_top">Top side banner</option>
            <option value="side_bottom">Bottom side banner</option>
          </select>
        </label>
        <label>Display order
          <input name="sort_order" type="number" min="0" max="999" step="1" defaultValue={item.sort_order}/>
        </label>
        <label>Badge / eyebrow
          <input name="badge" defaultValue={item.badge} maxLength={40}/>
        </label>
        <label>Headline
          <input name="title" defaultValue={item.title} required minLength={2} maxLength={100}/>
        </label>
        <label>Accent headline
          <input name="accent_text" defaultValue={item.accent_text} maxLength={100}/>
        </label>
        <label>Background colour
          <input name="background_color" type="color" defaultValue={item.background_color||"#eef6f2"}/>
        </label>
        <label className="full">Supporting text
          <textarea name="subtitle" defaultValue={item.subtitle} maxLength={240}/>
        </label>
        <label>Button label
          <input name="cta_label" defaultValue={item.cta_label} required minLength={2} maxLength={40}/>
        </label>
        <label>Button link
          <input name="cta_link" defaultValue={item.cta_link} required pattern="(?:https?://.*|/.*|#.*)" title="Use a full URL, a site path beginning with /, or a section beginning with #."/>
        </label>
        <label className="full image-upload">Banner images
          <input name="image_url" type="url" value={images[0]??""} onChange={e=>setImages(current=>[e.target.value,...current.slice(1)])} placeholder="Primary image URL" required/>
          <span><ImagePlus/> Upload multiple banner images<input type="file" accept="image/*" multiple onChange={e=>uploadMany(e.target.files)}/></span>
          <small>The first image is the primary slide. Multiple images automatically become a storefront carousel.</small>
          <div className="gallery-admin-preview">{images.map((url,index)=><figure key={`${url}-${index}`}><img src={url} alt={`Banner slide ${index+1}`}/><button type="button" onClick={()=>setImages(current=>current.filter((_,i)=>i!==index))}><X/></button><small>{index===0?"Primary":`Slide ${index+1}`}</small></figure>)}</div>
        </label>
        <label className="check"><input name="is_active" type="checkbox" defaultChecked={item.is_active}/> Active and visible</label>
      </div>
      <footer>
        <button type="button" onClick={close}>Cancel</button>
        <button>Save banner</button>
      </footer>
    </form>
  </div>
}
