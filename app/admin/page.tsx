"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { 
  BarChart3, Bell, Boxes, ChevronDown, CircleDollarSign, ImagePlus, 
  LayoutDashboard, LogOut, Menu, Package, Plus, Search, Settings, 
  ShoppingCart, Store, Tags, Trash2, Truck, Users, Wallet, X, 
  TrendingUp, ArrowUpRight, ArrowDownRight, Edit3, ClipboardCheck,
  ToggleLeft, ToggleRight, Minus, Eye, CheckCircle2, AlertTriangle, AlertCircle, ArrowRight, Clock
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { AuthModal } from "../components/AuthModal";

type Tab="Dashboard"|"Orders"|"Products"|"Customers"|"Categories"|"Analytics"|"Marketing"|"Settings";
const navigation:[Tab,any][]=[
  ["Dashboard", LayoutDashboard],
  ["Orders", ShoppingCart],
  ["Products", Package],
  ["Customers", Users],
  ["Categories", Tags],
  ["Analytics", BarChart3],
  ["Marketing", Bell],
  ["Settings", Settings]
];
const emptyProduct={name:"",slug:"",description:"",price:"",compare_at_price:"",image_url:"",badge:"New",rating:"4.5",inventory:"0",category_id:"",is_active:true};

export default function Admin(){
  const [tab,setTab]=useState<Tab>("Dashboard"),
        [access,setAccess]=useState<"checking"|"guest"|"denied"|"allowed"|"setup">("checking"),
        [auth,setAuth]=useState(false),
        [mobile,setMobile]=useState(false),
        [adminUser,setAdminUser]=useState({name:"Administrator",email:""});
  
  const [products,setProducts]=useState<any[]>([]),
        [orders,setOrders]=useState<any[]>([]),
        [customers,setCustomers]=useState<any[]>([]),
        [categories,setCategories]=useState<any[]>([]),
        [subscribers,setSubscribers]=useState<any[]>([]),
        [loading,setLoading]=useState(true),
        [search,setSearch]=useState("");
  
  const [editing,setEditing]=useState<any|null>(null),
        [editingBanner,setEditingBanner]=useState<any|null>(null),
        [banners,setBanners]=useState<any[]>([]),
        [categoryName,setCategoryName]=useState(""),
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

  // Collapsible sidebar state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Quick order viewer state
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<any | null>(null);

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
    const [p,o,cats,users,subs,settingsResult,bannerResult,imageRows]=await Promise.all([
      supabase.from("products").select("*,categories(name)").order("created_at",{ascending:false}),
      supabase.from("orders").select("*,order_items(product_name,quantity)").order("created_at",{ascending:false}),
      supabase.from("categories").select("*").order("name"),
      supabase.from("profiles").select("*").order("created_at",{ascending:false}),
      supabase.from("newsletter_subscribers").select("*").order("created_at",{ascending:false}),
      supabase.from("store_settings").select("*").eq("id",1).maybeSingle(),
      supabase.from("banners").select("*").order("placement").order("sort_order"),
      supabase.from("product_images").select("*").order("sort_order")
    ]);
    
    setProducts((p.data??[]).map((product:any)=>({
      ...product,
      product_images:(imageRows.data??[]).filter((image:any)=>image.product_id===product.id)
    })));
    setOrders(o.data??[]);
    setCategories(cats.data??[]);
    setCustomers(users.data??[]);
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
    payload.rating=Number(payload.rating);
    payload.inventory=Number(payload.inventory);
    if(!Number.isFinite(payload.price)||payload.price<=0) return flash("Enter a valid product price greater than zero.");
    if(payload.compare_at_price!==null&&payload.compare_at_price<payload.price) return flash("Compare price cannot be lower than the selling price.");
    if(!Number.isInteger(payload.inventory)||payload.inventory<0) return flash("Inventory must be a whole number of zero or more.");
    if(payload.rating<0||payload.rating>5) return flash("Rating must be between 0 and 5.");
    payload.is_active=f.get("is_active")==="on";
    const gallery=JSON.parse(String(f.get("gallery_urls")||"[]"));
    if(!gallery.length||gallery.some((url:string)=>{try{const parsed=new URL(url);return !["http:","https:"].includes(parsed.protocol)}catch{return true}})) return flash("Add at least one valid http or https product image URL.");
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
    if(!Number.isFinite(Number(storeSettings.free_shipping_threshold))||Number(storeSettings.free_shipping_threshold)<0) return flash("Free delivery threshold must be zero or more.");
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
        
  const filteredProducts=products.filter(p=>p.name.toLowerCase().includes(search.toLowerCase()));

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
  
  return <div className="dashboard-shell" style={{ display: "grid", gridTemplateColumns: sidebarCollapsed ? "76px 1fr" : "278px 1fr", transition: "grid-template-columns 0.3s ease" }}>{notice&&<div className="toast">{notice}</div>}
    {mobile&&<button className="sidebar-scrim" aria-label="Close navigation" onClick={()=>setMobile(false)}/>}
    
    <aside className={`sidebar ${mobile?"mobile-open":""} ${sidebarCollapsed ? "collapsed-mode" : ""}`} style={{ width: "100%", height: "100vh", position: "sticky", top: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <button className="close-side" aria-label="Close navigation" onClick={()=>setMobile(false)}><X/></button>
      
      <div style={{ display: "flex", alignItems: "center", justifyContent: sidebarCollapsed ? "center" : "space-between", padding: "16px 20px" }}>
        <Link href="/" className="logo"><span>T</span>{!sidebarCollapsed && "Taiga"}{!sidebarCollapsed && <small>ADMIN</small>}</Link>
        {!mobile && (
          <button 
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            style={{ 
              background: "none", 
              border: "none", 
              cursor: "pointer", 
              color: "var(--muted)",
              display: "grid",
              placeItems: "center"
            }}
          >
            <Menu size={16} />
          </button>
        )}
      </div>

      <p className="side-label" style={{ paddingLeft: sidebarCollapsed ? "0" : "20px", textAlign: sidebarCollapsed ? "center" : "left" }}>
        {sidebarCollapsed ? "•••" : "Store management"}
      </p>
      
      <nav className="side-nav" aria-label="Admin sections" style={{ flex: 1, padding: "0 10px" }}>
        {navigation.map(([name,Icon])=><button key={name} onClick={()=>{setTab(name);setMobile(false)}} className={tab===name?"active":""} style={{ display: "flex", alignItems: "center", justifyContent: sidebarCollapsed ? "center" : "flex-start", gap: "12px", width: "100%", padding: "10px 14px", borderRadius: "var(--radius-md)", marginBottom: "4px" }} title={name}><Icon size={17}/>{!sidebarCollapsed && <span>{name}</span>}{name==="Orders" && !sidebarCollapsed && <i style={{ marginLeft: "auto" }}>{orders.length}</i>}</button>)}
      </nav>
      
      <nav className="side-nav sidebar-bottom" style={{ padding: "10px" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", justifyContent: sidebarCollapsed ? "center" : "flex-start", gap: "12px", padding: "10px 14px", width: "100%" }}><Store/>{!sidebarCollapsed && <span>View store</span>}</Link>
        <button onClick={()=>supabase.auth.signOut()} style={{ display: "flex", alignItems: "center", justifyContent: sidebarCollapsed ? "center" : "flex-start", gap: "12px", padding: "10px 14px", width: "100%", background: "none", border: "none" }}><LogOut/>{!sidebarCollapsed && <span>Sign out</span>}</button>
      </nav>
    </aside>

    <main className="dash-main">
      <header className="dash-topbar">
        <button className="dashboard-mobile" aria-label="Open navigation" onClick={()=>setMobile(true)}><Menu/></button>
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
            <div className="admin-table-wrap" style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden", marginTop: "24px" }}>
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
                  {filteredProducts.map(p=>(
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
            </div>
          )}

          {tab==="Customers" && (
            <div className="admin-table-wrap" style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden", marginTop: "24px" }}>
              <table className="admin-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--secondary)", borderBottom: "1px solid var(--border)" }}>
                    <th style={{ padding: "16px", textAlign: "left", fontSize: "11px", fontWeight: "800", textTransform: "uppercase", color: "var(--muted)" }}>Customer Name</th>
                    <th style={{ padding: "16px", textAlign: "left", fontSize: "11px", fontWeight: "800", textTransform: "uppercase", color: "var(--muted)" }}>Email address</th>
                    <th style={{ padding: "16px", textAlign: "left", fontSize: "11px", fontWeight: "800", textTransform: "uppercase", color: "var(--muted)" }}>Account Role</th>
                    <th style={{ padding: "16px", textAlign: "left", fontSize: "11px", fontWeight: "800", textTransform: "uppercase", color: "var(--muted)" }}>Date Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map(c=>(
                    <tr key={c.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "16px", fontSize: "13px" }}>
                        <strong>{c.full_name||c.email?.split("@")[0]||"Customer"}</strong>
                      </td>
                      <td style={{ padding: "16px", fontSize: "13px", color: "var(--muted)" }}>{c.email || "—"}</td>
                      <td style={{ padding: "16px" }}>
                        <span className="role-pill" style={{ textTransform: "uppercase" }}>{c.role}</span>
                      </td>
                      <td style={{ padding: "16px", fontSize: "13px", color: "var(--muted)" }}>{new Date(c.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

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
                
                <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", fontWeight: 700 }}>
                  Free delivery threshold (₦)
                  <input type="number" min="0" max="1000000000" step="1" value={storeSettings.free_shipping_threshold||0} onChange={e=>setStoreSettings({...storeSettings,free_shipping_threshold:Number(e.target.value)})} required style={{ height: "40px", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "0 12px", fontSize: "13px", background: "var(--card-bg)" }} />
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

    {editing&&<ProductEditor item={editing} categories={categories} close={()=>setEditing(null)} submit={saveProduct} upload={uploadImage}/>} 
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
                  <span>{item.product_name} <strong>× {item.quantity}</strong></span>
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

function OrdersTable({orders,change,onViewDetails}:{orders:any[];change:(id:string,s:string)=>void;onViewDetails:(order:any)=>void}){
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
          {orders.map(o=>(
            <tr key={o.id} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={{ padding: "16px" }}>
                <strong style={{ fontSize: "13px" }}>{o.order_number}</strong>
              </td>
              <td style={{ padding: "16px", fontSize: "12px", color: "var(--muted)", maxWidth: "240px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {o.order_items?.map((i:any)=>`${i.product_name} ×${i.quantity}`).join(", ")}
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
  </div>
}

function ProductEditor({item,categories,close,submit,upload}:{item:any;categories:any[];close:()=>void;submit:(e:React.FormEvent<HTMLFormElement>)=>void;upload:(f:File,set:(u:string)=>void)=>void}){
  const [gallery,setGallery]=useState<string[]>(item.product_images?.sort((a:any,b:any)=>a.sort_order-b.sort_order).map((i:any)=>i.image_url)??(item.image_url?[item.image_url]:[]));
  const uploadMany=async(files:FileList|null)=>{
    if(!files) return;
    const added:string[]=[];
    for(const file of Array.from(files)){
      await upload(file,(url)=>added.push(url));
    }
    setGallery(current=>[...current,...added]);
  };
  
  return <div className="modal-overlay">
    <form className="product-editor animate-scale-up" onSubmit={submit}>
      <input type="hidden" name="gallery_urls" value={JSON.stringify(gallery)}/>
      <header>
        <h2>{item.id?"Edit product":"Add product"}</h2>
        <button type="button" onClick={close}><X/></button>
      </header>
      <div className="editor-grid">
        <label>Product name
          <input name="name" defaultValue={item.name} required minLength={2} maxLength={120} onBlur={e=>{
            const slug=(e.currentTarget.form?.elements.namedItem("slug") as HTMLInputElement);
            if(slug&&!slug.value) slug.value=e.target.value.toLowerCase().replace(/[^a-z0-9]+/g,"-");
          }}/>
        </label>
        <label>Slug
          <input name="slug" defaultValue={item.slug} required minLength={2} maxLength={140} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" title="Use lowercase letters, numbers and single hyphens only."/>
        </label>
        <label>Category
          <select name="category_id" defaultValue={item.category_id} required>
            <option value="">Choose category</option>
            {categories.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label>Price
          <input name="price" type="number" min="0.01" max="1000000000" step=".01" defaultValue={item.price} required/>
        </label>
        <label>Compare price
          <input name="compare_at_price" type="number" min="0.01" max="1000000000" step=".01" defaultValue={item.compare_at_price}/>
        </label>
        <label>Inventory
          <input name="inventory" type="number" min="0" max="10000000" step="1" defaultValue={item.inventory} required/>
        </label>
        <label>Badge
          <input name="badge" defaultValue={item.badge} maxLength={30}/>
        </label>
        <label>Rating
          <input name="rating" type="number" min="0" max="5" step=".1" defaultValue={item.rating}/>
        </label>
        <label className="full">Description
          <textarea name="description" defaultValue={item.description} minLength={10} maxLength={3000}/>
        </label>
        <label className="full image-upload">Primary image URL
          <input name="image_url" type="url" value={gallery[0]??""} onChange={e=>setGallery(current=>[e.target.value,...current.slice(1)])} placeholder="https://example.com/product.jpg" required/>
          <span><ImagePlus/> Upload multiple images<input type="file" accept="image/*" multiple onChange={e=>uploadMany(e.target.files)}/></span>
          <div className="gallery-admin-preview">
            {gallery.map((url,index)=>(
              <figure key={`${url}-${index}`}>
                <img src={url} alt=""/>
                <button type="button" onClick={()=>setGallery(current=>current.filter((_,i)=>i!==index))}><X/></button>
                <small>{index===0?"Primary":index+1}</small>
              </figure>
            ))}
          </div>
        </label>
        <label className="check"><input name="is_active" type="checkbox" defaultChecked={item.is_active}/> Active and visible</label>
      </div>
      <footer>
        <button type="button" onClick={close}>Cancel</button>
        <button>Save product</button>
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
