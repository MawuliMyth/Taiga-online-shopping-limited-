"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { AuthModal } from "./components/AuthModal";
import { StorePanels } from "./components/StorePanels";
import {
  ArrowRight, BadgeCheck, ChevronDown, ChevronLeft, ChevronRight, CircleUserRound,
  Heart, Headphones, Laptop, Menu, PackageCheck, Search, Shirt,
  ShoppingBag, ShoppingCart, Smartphone, Sparkles, Star, Store, Truck,
  X, Zap, Sun, Moon, Clock, MapPin, ClipboardCheck
} from "lucide-react";

const defaultCategories = [
  { name: "Computers and Accessories", icon: Laptop, image: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=400&q=80", subcategories:["Laptops","Desktop Computers","Monitors","Computer Accessories"] },
  { name: "Phones and tablets", icon: Smartphone, image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=400&q=80", subcategories:["Mobile Phones","iPhone","Phone Accessories","Tablets"] },
  { name: "Electronics", icon: Headphones, image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=400&q=80", subcategories:["Televisions","Audio & Headphones","Cameras","Home Theatre","Gaming"] },
  { name: "Fashion", icon: Shirt, image: "https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?auto=format&fit=crop&w=400&q=80", subcategories:["Men's Fashion","Women's Fashion","Shoes","Bags","Watches"] },
  { name: "Home and Kitchen", icon: Store, image: "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=400&q=80", subcategories:["Large Appliances","Small Appliances","Home Furnishings","Kitchen and Dining"] },
  { name: "Drinks and Groceries", icon: ShoppingBag, image: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80", subcategories:["Drinks","Alcoholic Beverages","Foods","Beverages"] },
  { name: "Others", icon: Sparkles, image: "https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=400&q=80", subcategories:["Generators","UPS and Surge Protectors","Solar Energy"] },
];

const departmentDetails: Record<string,{title:string;items:string[]}[]> = {
  "Computers and Accessories":[{title:"Computers",items:["Laptops","Desktop Computers","Monitors","Computer Components"]},{title:"Accessories",items:["Keyboards and Mice","Storage Devices","Printers","Networking"]}],
  "Phones and tablets":[{title:"Phones",items:["Mobile Phones (Smartphones and Feature Phones)","iPhone","Desk, Radio and Intercom Phones"]},{title:"Accessories",items:["Mobile Phone Accessories","Tablet Accessories"]},{title:"Tablets",items:["Tablets","Android Tablets","iPads"]}],
  Electronics:[{title:"Television & Video",items:["Smart TVs","LED TVs","Projectors","Streaming Devices"]},{title:"Audio",items:["Headphones","Bluetooth Speakers","Home Theatre","Soundbars"]},{title:"Cameras",items:["Digital Cameras","Security Cameras","Camera Accessories"]}],
  Fashion:[{title:"Women's Fashion",items:["Dresses","Shoes","Handbags","Jewellery"]},{title:"Men's Fashion",items:["Shirts","Trousers","Sneakers","Watches"]},{title:"Kids",items:["Girls' Fashion","Boys' Fashion","School Wear"]}],
  "Home and Kitchen":[{title:"Appliances",items:["Large Appliances","Small Appliances"]},{title:"Home",items:["Home Furnishings","Furniture","Kids Home Store"]},{title:"Kitchen",items:["Kitchen and Dining","Top Brands"]}],
  "Drinks and Groceries":[{title:"Drinks",items:["Drinks","Alcoholic Beverages","Beverages"]},{title:"Food",items:["Foods","Food Cupboard","Breakfast Foods"]}],
  Others:[{title:"Power",items:["Generators and Accessories","UPS and Surge Protectors","Solar and Alternative Energy"]}],
};

const categoryAliases:Record<string,string>={Computing:"Computers and Accessories",Mobile:"Phones and tablets",Groceries:"Drinks and Groceries",Beauty:"Others"};

type Product = { id: string; slug: string; name: string; category: string; price: number; old: number; rating: number; badge: string; image: string };

function ProductCard({ product, onAdd, onLike, isLiked }: { product: Product; onAdd: () => void; onLike: () => void; isLiked: boolean }) {
  const [liked, setLiked] = useState(isLiked);
  useEffect(() => setLiked(isLiked), [isLiked]);
  
  // Stable pseudo-random review count based on product name
  const reviewCount = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < product.name.length; i++) {
      hash = product.name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash % 85) + 12; // Between 12 and 96
  }, [product.name]);

  return <article className="product-card">
    <div className="product-media">
      {product.badge && <span className="product-badge">{product.badge}</span>}
      <button className={`heart ${liked ? "liked" : ""}`} onClick={(e) => { e.preventDefault(); setLiked(!liked); onLike(); }} aria-label={`Save ${product.name}`}><Heart size={18} fill={liked ? "currentColor" : "none"} /></button>
      <Link href={`/product/${product.slug}`}><img src={product.image} alt={product.name} /></Link>
    </div>
    <div className="product-copy">
      <span className="product-category">{product.category}</span>
      <h3><Link href={`/product/${product.slug}`}>{product.name}</Link></h3>
      <div className="rating"><Star size={14} fill="currentColor" /> {product.rating} <span>({reviewCount})</span></div>
      <div className="product-bottom">
        <div>
          <strong>₦{product.price.toLocaleString()}</strong>
          {product.old > product.price && <del style={{ marginLeft: "8px", fontSize: "11px", color: "var(--muted-light)" }}>₦{product.old.toLocaleString()}</del>}
        </div>
        <button onClick={(e) => { e.preventDefault(); onAdd(); }} aria-label={`Add ${product.name} to cart`}><ShoppingCart size={17} /></button>
      </div>
    </div>
  </article>;
}

export default function Home() {
  const [cart, setCart] = useState(0);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState("All");
  const [liveProducts, setLiveProducts] = useState<Product[]>([]);
  const [catalogLoading,setCatalogLoading]=useState(true);
  const [catalogError,setCatalogError]=useState("");
  const [user, setUser] = useState<User | null>(null);
  const [authReady,setAuthReady]=useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [authReason,setAuthReason]=useState("Please sign in first to continue.");
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState("");
  const [panel,setPanel]=useState<"cart"|"wishlist"|"orders"|null>(null);
  const [searchOpen,setSearchOpen]=useState(false);
  const [departmentsOpen,setDepartmentsOpen]=useState(false);
  const [hoveredDepartment,setHoveredDepartment]=useState("Electronics");
  const [timeLeft,setTimeLeft]=useState(22*60+17);
  const [storeSettings,setStoreSettings]=useState<any>({announcement_left:"Free delivery on orders over ₦50,000",announcement_center:"Football celebration: save up to 50%",announcement_right:"Call / WhatsApp: 0800 466 3639",flash_sale_title:"Flash Sales",support_phone:"0800 466 3639"});
  const [banners,setBanners]=useState<any[]>([]);
  const [bannersLoaded,setBannersLoaded]=useState(false);
  const [heroSlide,setHeroSlide]=useState(0),[heroPaused,setHeroPaused]=useState(false);
  const [catalogCategories,setCatalogCategories]=useState(defaultCategories);
  const [footerPanel,setFooterPanel]=useState<null|"story"|"delivery"|"returns"|"privacy"|"terms">(null);

  // Theme support
  const [theme, setTheme] = useState("light");
  
  // Order Tracking support
  const [trackerOpen, setTrackerOpen] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackedOrder, setTrackedOrder] = useState<any>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState("");

  const filtered = useMemo(() => liveProducts.filter(p => (active === "All" || p.category === active) && p.name.toLowerCase().includes(query.toLowerCase())), [active, query, liveProducts]);

  useEffect(() => {
    // Theme initialization
    const savedTheme = localStorage.getItem("theme") || "light";
    setTheme(savedTheme);
    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    supabase.auth.getSession().then(({data}) => {setUser(data.session?.user??null);setAuthReady(true)});
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {setUser(session?.user ?? null);setAuthReady(true);if(session?.user)setShowAuth(false)});
    supabase.from("products").select("id,slug,name,price,compare_at_price,rating,badge,image_url,categories(name)").eq("is_active", true).then(({data,error}) => {
      if(error)setCatalogError("The catalogue could not be loaded. Please try again shortly.");
      else setLiveProducts((data??[]).map((p: any) => ({id:p.id,slug:p.slug,name:p.name,category:categoryAliases[p.categories?.name]??p.categories?.name??"Others",price:Number(p.price),old:Number(p.compare_at_price ?? p.price),rating:Number(p.rating),badge:p.badge ?? "New",image:p.image_url})));
      setCatalogLoading(false);
    });
    const loadStoreSettings=()=>supabase.from("store_settings").select("*").eq("id",1).maybeSingle().then(({data})=>{if(data){setStoreSettings(data);if(data.flash_sale_ends_at)setTimeLeft(Math.max(0,Math.floor((new Date(data.flash_sale_ends_at).getTime()-Date.now())/1000)))}});
    loadStoreSettings();
    const refreshStoreSettings=()=>loadStoreSettings();
    window.addEventListener("focus",refreshStoreSettings);
    supabase.from("banners").select("*").eq("is_active",true).order("sort_order").then(({data})=>{setBanners(data??[]);setBannersLoaded(true)});
    return () => {listener.subscription.unsubscribe();window.removeEventListener("focus",refreshStoreSettings)};
  }, []);

  useEffect(()=>{if(!authReady)return;const url=new URL(window.location.href),requested=url.searchParams.get("panel");if(requested!=="cart")return;url.searchParams.delete("panel");window.history.replaceState({},"",`${url.pathname}${url.search}${url.hash}`);if(user){setShowAuth(false);setPanel("cart")}else requireAuth("Please sign in first to view and manage your cart.")},[user,authReady]);
  useEffect(()=>{const timer=window.setInterval(()=>setTimeLeft(v=>v>0?v-1:86400),1000);return()=>window.clearInterval(timer)},[]);

  useEffect(() => {
    if (!user) { setCart(0); setWishlist(new Set()); return; }
    supabase.from("cart_items").select("quantity").eq("user_id",user.id).then(({data})=>setCart(data?.reduce((sum,row)=>sum+row.quantity,0) ?? 0));
    supabase.from("wishlist_items").select("product_id").eq("user_id",user.id).then(({data})=>setWishlist(new Set(data?.map(row=>row.product_id) ?? [])));
  },[user]);

  function toggleTheme() {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }

  function flash(text:string){setNotice(text); window.setTimeout(()=>setNotice(""),2400)}
  function requireAuth(reason:string){setAuthReason(reason);setShowAuth(true)}
  async function openProtectedPanel(target:"cart"|"wishlist"|"orders",reason:string){const current=user??(await supabase.auth.getSession()).data.session?.user??null;if(current){setUser(current);setShowAuth(false);setPanel(target);return}requireAuth(reason)}
  
  async function addToCart(product: Product){
    if(!user){requireAuth("Please sign in first to add products to your cart.");return}
    const existing = await supabase.from("cart_items").select("quantity").eq("user_id",user.id).eq("product_id",product.id).maybeSingle();
    const result = existing.data ? await supabase.from("cart_items").update({quantity:existing.data.quantity+1,updated_at:new Date().toISOString()}).eq("user_id",user.id).eq("product_id",product.id) : await supabase.from("cart_items").insert({user_id:user.id,product_id:product.id,quantity:1});
    if(result.error) return flash("Cart could not be updated yet."); setCart(cart+1); flash("Added to your cart");
  }

  async function toggleWishlist(product: Product){
    if(!user){requireAuth("Please sign in first to save products to your wishlist.");return}
    const id=String(product.id); const next=new Set(wishlist);
    if(next.has(id)){next.delete(id);await supabase.from("wishlist_items").delete().eq("user_id",user.id).eq("product_id",product.id)}else{next.add(id);await supabase.from("wishlist_items").insert({user_id:user.id,product_id:product.id})}
    setWishlist(next);
  }

  async function reloadCounts(){if(!user)return;const [{data:cartRows},{data:wishRows}]=await Promise.all([supabase.from("cart_items").select("quantity").eq("user_id",user.id),supabase.from("wishlist_items").select("product_id").eq("user_id",user.id)]);setCart(cartRows?.reduce((sum,row)=>sum+row.quantity,0)??0);setWishlist(new Set(wishRows?.map(row=>row.product_id)??[]))}
  async function subscribe(e:React.FormEvent<HTMLFormElement>){e.preventDefault();const form=new FormData(e.currentTarget);const email=String(form.get("email")??"");const {error}=await supabase.from("newsletter_subscribers").insert({email});flash(error?.code==="23505"?"You are already subscribed":error?"Subscription is not ready yet":"Welcome — your 15% code is TAIGA15");if(!error)e.currentTarget.reset()}
  
  // Track order handler
  async function handleTrackOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!trackingNumber.trim()) return;
    
    setTrackingLoading(true);
    setTrackingError("");
    setTrackedOrder(null);

    if (!user) {
      setTrackingLoading(false);
      setTrackingError("Please sign in to your account first to track orders.");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, total, status, created_at, shipping_address, order_items(product_name, quantity, unit_price)")
        .eq("user_id", user.id)
        .eq("order_number", trackingNumber.trim().toUpperCase())
        .maybeSingle();

      if (error) {
        setTrackingError("An error occurred while looking up this order reference.");
      } else if (!data) {
        setTrackingError("No order found under this reference in your account.");
      } else {
        setTrackedOrder(data);
      }
    } catch (err) {
      setTrackingError("An unexpected error occurred. Please try again.");
    } finally {
      setTrackingLoading(false);
    }
  }

  const heroBanner=banners.find(b=>b.placement==="hero"),sideTop=banners.find(b=>b.placement==="side_top"),sideBottom=banners.find(b=>b.placement==="side_bottom"),heroImages=(Array.isArray(heroBanner?.image_urls)&&heroBanner.image_urls.length?heroBanner.image_urls:[heroBanner?.image_url]).filter(Boolean);
  useEffect(()=>{setHeroSlide(0)},[heroBanner?.id]);
  useEffect(()=>{if(heroImages.length<2||heroPaused)return;const timer=window.setInterval(()=>setHeroSlide(index=>(index+1)%heroImages.length),5000);return()=>window.clearInterval(timer)},[heroImages.length,heroPaused]);

  return <div className="storefront">{showAuth&&<AuthModal reason={authReason} onClose={()=>setShowAuth(false)}/>} {panel&&user&&<StorePanels kind={panel} user={user} onClose={()=>setPanel(null)} onChanged={reloadCounts}/>} {notice&&<div className="toast">{notice}</div>}
    <div className="announcement"><span>{storeSettings.announcement_left}</span><span>{storeSettings.announcement_center}</span><span>Call / WhatsApp: {storeSettings.support_phone||"0800 466 3639"}</span></div>
    <header className="site-header">
      <div className="header-main wrap">
        <Link href="/" className="logo"><span>T</span>Taiga<small>MARKET</small></Link>
        <div className="search-shell"><div className="search"><Search size={19} /><input value={query} onFocus={()=>setSearchOpen(true)} onChange={e => {setQuery(e.target.value);setSearchOpen(true)}} placeholder="Search products, brands and categories" /><button onClick={()=>{setSearchOpen(false);document.querySelector("#deals")?.scrollIntoView({behavior:"smooth"})}}>Search</button></div>{searchOpen&&<div className="search-popover"><div className="search-popover-title"><span>{query?"Matching products":"Trending searches"}</span><button onClick={()=>setSearchOpen(false)}><X size={16}/></button></div>{query?<div className="search-results">{liveProducts.filter(p=>p.name.toLowerCase().includes(query.toLowerCase())).slice(0,5).map(p=><button key={p.id} onClick={()=>{setQuery(p.name);setSearchOpen(false);document.querySelector("#deals")?.scrollIntoView({behavior:"smooth"})}}><img src={p.image} alt=""/><span>{p.name}<small>{p.category}</small></span><strong>₦{p.price.toLocaleString()}</strong></button>)}</div>:<div className="trend-tags">{["headphones","air fryer","iphone","shoes for men","smart watch"].map(t=><button key={t} onClick={()=>{setQuery(t);setSearchOpen(false)}}>{t}</button>)}</div>}</div>}</div>
        <div className="header-actions">
          <button className="theme-toggle-btn" onClick={toggleTheme} aria-label="Toggle dark mode">
            {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          <button onClick={()=>openProtectedPanel("orders","Please sign in first to access your account and orders.")}><CircleUserRound /><span>{!authReady?"Checking account":user?"Your account":"Hello, sign in"}<small>{user ? user.email?.split("@")[0] : "My account"}</small></span></button>
          <button className="icon-action" onClick={()=>openProtectedPanel("wishlist","Please sign in first to view your saved products.")} aria-label="Open wishlist"><Heart /><b>{wishlist.size}</b></button>
          <button className="icon-action cart-action" onClick={()=>openProtectedPanel("cart","Please sign in first to view and manage your cart.")} aria-label="Open cart"><ShoppingCart /><span>Cart</span><b>{cart}</b></button>
        </div>
      </div>
      <nav className="nav wrap">
        <button className="departments" onMouseEnter={()=>setDepartmentsOpen(true)} onFocus={()=>setDepartmentsOpen(true)} onClick={()=>setDepartmentsOpen(!departmentsOpen)}><Menu size={17} /> Categories <ChevronDown size={15} /></button>
        <a href="#deals">Today&apos;s deals</a><a href="#categories">Categories</a><a href="#new">New arrivals</a><a href="#popular">Most wanted</a>
        <button onClick={() => setTrackerOpen(true)} className="admin-link" style={{ background: "transparent", border: "0", cursor: "pointer", fontSize: "inherit", fontWeight: "inherit", padding: "8px 0" }}>
          <ClipboardCheck size={16} /> Track Order
        </button>
      </nav>
      {departmentsOpen&&<div className="mega-menu wrap" onMouseLeave={()=>setDepartmentsOpen(false)}><aside>{catalogCategories.map(({name,icon:Icon})=><button className={hoveredDepartment===name?"active":""} key={name} onMouseEnter={()=>setHoveredDepartment(name)} onFocus={()=>setHoveredDepartment(name)} onClick={()=>{setActive(name);setQuery("");setDepartmentsOpen(false);document.querySelector("#deals")?.scrollIntoView({behavior:"smooth"})}}><Icon size={17}/>{name}<ChevronRight size={14}/></button>)}</aside><div className="mega-detail"><div className="mega-detail-heading"><span>Explore</span><h3>{hoveredDepartment}</h3></div><div className="mega-columns">{(departmentDetails[hoveredDepartment]??[{title:hoveredDepartment,items:[`All ${hoveredDepartment}`,"New arrivals","Best sellers"]}]).map(group=><div key={group.title}><h4>{group.title}</h4>{group.items.map(item=><button key={item} onClick={()=>{setActive(hoveredDepartment);setQuery("");setDepartmentsOpen(false);document.querySelector("#deals")?.scrollIntoView({behavior:"smooth"})}}>{item}</button>)}</div>)}</div></div><div className="mega-support"><strong>Need help?</strong><span>Call / WhatsApp</span><b>{storeSettings.support_phone||"0800 466 3639"}</b><a href={`mailto:${storeSettings.support_email||"support@taiga.ng"}`}>Contact support</a></div></div>}
    </header>

    <main>
      {!bannersLoaded?<section className="hero wrap hero-banner-shimmer" aria-label="Loading promotions"><div/><div/></section>:heroBanner&&<section className={`hero wrap ${!sideTop&&!sideBottom?"hero-only":""}`}>
        <div className={`hero-main ${heroImages.length?"managed-banner":""}`} style={heroImages.length?{backgroundColor:heroBanner?.background_color||undefined}:undefined} onMouseEnter={()=>setHeroPaused(true)} onMouseLeave={()=>setHeroPaused(false)}>
          {heroImages.length>0&&<div className="hero-slides" aria-live="polite">{heroImages.map((image:string,index:number)=><img key={`${image}-${index}`} className={index===heroSlide?"active":""} src={image} alt={index===heroSlide?`${heroBanner?.title||"Promotion"} slide ${index+1}`:""}/>)}</div>}
          <div className="hero-copy"><span className="eyebrow"><Zap size={15} /> {heroBanner.badge}</span><h1>{heroBanner.title}<br/>{heroBanner.accent_text&&<em>{heroBanner.accent_text}</em>}</h1>{heroBanner.subtitle&&<p>{heroBanner.subtitle}</p>}<a className="hero-cta" href={heroBanner.cta_link}>{heroBanner.cta_label} <ArrowRight size={18} /></a><div className="hero-trust"><BadgeCheck size={18} /> Genuine products <span>•</span> Nationwide delivery</div></div>
          {heroImages.length>1&&<><button className="hero-slide-arrow previous" onClick={()=>setHeroSlide(index=>(index-1+heroImages.length)%heroImages.length)} aria-label="Previous banner"><ChevronLeft/></button><button className="hero-slide-arrow next" onClick={()=>setHeroSlide(index=>(index+1)%heroImages.length)} aria-label="Next banner"><ChevronRight/></button><div className="hero-slide-dots" aria-label="Banner slides">{heroImages.map((_:string,index:number)=><button key={index} className={index===heroSlide?"active":""} onClick={()=>setHeroSlide(index)} aria-label={`Show banner ${index+1}`}><span/></button>)}</div></>}
        </div>
        {(sideTop||sideBottom)&&<div className="hero-side">
          {sideTop&&<article className="mini-promo audio" style={{background:sideTop.background_color}}><div><small>{sideTop.badge}</small><h3>{sideTop.title}</h3><a href={sideTop.cta_link}>{sideTop.cta_label} <ArrowRight size={14}/></a></div><img src={sideTop.image_url} alt={sideTop.title} /></article>}
          {sideBottom&&<article className="mini-promo style" style={{background:sideBottom.background_color}}><div><small>{sideBottom.badge}</small><h3>{sideBottom.title}</h3><a href={sideBottom.cta_link}>{sideBottom.cta_label} <ArrowRight size={14}/></a></div><img src={sideBottom.image_url} alt={sideBottom.title} /></article>}
        </div>}
      </section>}

      <section className="benefits wrap" id="service"><button onClick={()=>setFooterPanel("delivery")}><Truck /><span><strong>Nationwide delivery</strong><small>Free over ₦50,000</small></span></button><button onClick={()=>setFooterPanel("returns")}><PackageCheck /><span><strong>Easy returns</strong><small>14-day return policy</small></span></button><button onClick={()=>setFooterPanel("terms")}><BadgeCheck /><span><strong>Secure payment</strong><small>Bank transfer or card</small></span></button><a href={`tel:${String(storeSettings.support_phone||"").replace(/\s/g,"")}`}><Headphones /><span><strong>Call support</strong><small>{storeSettings.support_phone||"0800 466 3639"}</small></span></a></section>

      <section className="section wrap" id="categories"><div className="section-heading"><div><span className="kicker">Find your favorite</span><h2>Shop by category</h2></div><button onClick={()=>{setActive("All");setQuery("");document.querySelector("#deals")?.scrollIntoView({behavior:"smooth"})}}>View all <ArrowRight size={16}/></button></div><div className="category-grid">{catalogCategories.map(({name,image,icon:Icon,subcategories})=><article className={`category-item ${active===name?"active":""}`} key={name}><button className="category-main" onClick={()=>setActive(name)}><div><img src={image} alt=""/><span><Icon size={17}/></span></div><strong>{name}</strong><small>{liveProducts.filter(p=>p.category===name).length} products</small><ChevronRight className="category-chevron" size={15}/></button><div className="subcategory-menu"><div><Icon size={18}/><strong>{name}</strong></div>{subcategories.map(sub=><button key={sub} onClick={()=>{setActive(name);setQuery("");document.querySelector("#deals")?.scrollIntoView({behavior:"smooth"})}}>{sub}<ChevronRight size={12}/></button>)}<button className="view-category" onClick={()=>{setActive(name);document.querySelector("#deals")?.scrollIntoView({behavior:"smooth"})}}>View all {name}</button></div></article>)}</div></section>

      <section className="section wrap" id="deals"><div className="flash-heading"><div><Zap size={20}/><h2>{storeSettings.flash_sale_title||"Flash Sales"}</h2></div><strong>Time left: {String(Math.floor(timeLeft/3600)).padStart(2,"0")}h : {String(Math.floor(timeLeft%3600/60)).padStart(2,"0")}m : {String(timeLeft%60).padStart(2,"0")}s</strong><button onClick={()=>setActive("All")}>See all <ChevronRight size={16}/></button></div><div className="deal-filter"><div className="tabs">{["All", ...catalogCategories.map(c => c.name)].map(t => <button className={active === t ? "active":""} onClick={() => setActive(t)} key={t}>{t}</button>)}</div></div>{catalogLoading?<div className="product-grid catalogue-shimmer" aria-label="Loading products">{[1,2,3,4].map(item=><div key={item}><span/><span/><span/></div>)}</div>:catalogError?<div className="empty-state"><strong>Catalogue unavailable</strong><p>{catalogError}</p><button onClick={()=>window.location.reload()}>Try again</button></div>:filtered.length?<div className="product-grid">{filtered.slice(0,4).map(product => <ProductCard key={product.id} product={product} onAdd={() => addToCart(product)} onLike={()=>toggleWishlist(product)} isLiked={wishlist.has(String(product.id))} />)}</div>:<div className="empty-state"><strong>{query?`No products match “${query}”`:"No products are available yet"}</strong><p>{query?"Try another search or category.":"Please check back soon for new products."}</p></div>}</section>

      {liveProducts.length>4&&<section className="section wrap" id="popular"><div className="section-heading"><div><span className="kicker" id="new">Loved by shoppers · New arrivals</span><h2>Most wanted right now</h2></div><button onClick={()=>{setActive("All");document.querySelector("#deals")?.scrollIntoView({behavior:"smooth"})}}>See everything <ArrowRight size={16}/></button></div><div className="product-grid">{liveProducts.slice(4,8).map(product => <ProductCard key={product.id} product={product} onAdd={() => addToCart(product)} onLike={()=>toggleWishlist(product)} isLiked={wishlist.has(String(product.id))} />)}</div></section>}

      <section className="newsletter"><div className="wrap"><div><span className="kicker">Good news, delivered</span><h2>Save 15% on your first order</h2><p>Join for fresh drops, member-only prices and practical inspiration.</p></div><form className="validated-form" onSubmit={subscribe}><input name="email" type="email" maxLength={254} autoComplete="email" placeholder="Your email address" aria-label="Email address" required/><button>Get my 15% <ArrowRight size={16}/></button></form></div></section>
    </main>

    <footer id="about"><div className="wrap footer-grid"><div><Link href="/" className="logo footer-logo"><span>T</span>Taiga<small>MARKET</small></Link><p>Everyday essentials and exciting finds, curated to make life feel a little better.</p><div className="store-badge"><Store size={18}/> Trusted by 25,000+ shoppers</div></div><div><h4>Shop</h4><a href="#deals">Today&apos;s deals</a><a href="#new">New arrivals</a><a href="#popular">Best sellers</a><button onClick={()=>{setActive("All");setQuery("");document.querySelector("#categories")?.scrollIntoView({behavior:"smooth"})}}>All categories</button></div><div><h4>Help</h4><a href={`mailto:${storeSettings.support_email||"support@taiga.ng"}`}>Contact us</a><button onClick={()=>setFooterPanel("delivery")}>Delivery information</button><button onClick={()=>setFooterPanel("returns")}>Returns & refunds</button><a href={`mailto:${storeSettings.support_email||"support@taiga.ng"}?subject=Taiga%20Market%20question`}>Ask a question</a></div><div><h4>Company</h4><button onClick={()=>setFooterPanel("story")}>Our story</button><a href={`tel:${String(storeSettings.support_phone||"").replace(/\s/g,"")}`}>Call support</a><button onClick={()=>setFooterPanel("privacy")}>Privacy policy</button><button onClick={()=>setFooterPanel("terms")}>Terms & conditions</button></div></div><div className="footer-bottom wrap"><span>© 2026 Taiga Online Shopping Limited. All rights reserved.</span><span>Visa · Mastercard · Verve · Bank transfer</span></div></footer>
    
    {footerPanel&&<div className="info-modal-overlay" role="presentation" onMouseDown={e=>e.target===e.currentTarget&&setFooterPanel(null)}><section className="info-modal" role="dialog" aria-modal="true" aria-labelledby="info-title"><button className="info-close" onClick={()=>setFooterPanel(null)} aria-label="Close"><X/></button><span className="kicker">Taiga customer care</span><h2 id="info-title">{{story:"Our story",delivery:"Delivery information",returns:"Returns & refunds",privacy:"Privacy policy",terms:"Terms & conditions"}[footerPanel]}</h2>{footerPanel==="story"&&<><p>Taiga Online Shopping Limited is a Nigerian online marketplace built to make reliable products easier to discover and buy. We bring together verified products, clear pricing and responsive local support.</p><p>Our goal is simple: dependable shopping, fair value and a customer experience that feels human.</p></>}{footerPanel==="delivery"&&<><p>We deliver nationwide. Delivery timing and cost are shown before you confirm your order, based on your location and selected delivery method.</p><ul><li>Standard delivery: typically 2–5 business days</li><li>Pick-up station: collect from your selected location</li><li>Free delivery applies when the cart reaches the threshold shown at checkout</li></ul></>}{footerPanel==="returns"&&<><p>Eligible products can be returned within 14 days of delivery. Items must be unused, complete and returned with their original packaging.</p><p>Contact <a href={`mailto:${storeSettings.support_email||"support@taiga.ng"}`}>{storeSettings.support_email||"support@taiga.ng"}</a> with your order number to begin a return.</p></>}{footerPanel==="privacy"&&<><p>We use account, address and order information only to operate the store, fulfil purchases, provide support and improve the service. We do not sell your personal data.</p><p>You can request account-data assistance through our support email.</p></>}{footerPanel==="terms"&&<><p>Prices, availability and delivery estimates are confirmed during checkout. Orders are subject to inventory verification and successful payment where applicable.</p><p>Card and bank payments should only be completed through the secure checkout options presented by Taiga Online Shopping Limited.</p></>}<div className="info-actions"><a href={`mailto:${storeSettings.support_email||"support@taiga.ng"}`}>Email support</a><button onClick={()=>setFooterPanel(null)}>Done</button></div></section></div>}
    
    {/* Live Order Tracker Modal */}
    {trackerOpen && (
      <div className="info-modal-overlay" role="presentation" onMouseDown={e => e.target === e.currentTarget && setTrackerOpen(false)}>
        <section className="info-modal" role="dialog" aria-modal="true" style={{ maxWidth: "620px" }}>
          <button className="info-close" onClick={() => setTrackerOpen(false)} aria-label="Close"><X /></button>
          <span className="kicker">Order tracking tool</span>
          <h2>Track your shipment</h2>
          <p>Enter your GN order reference below to check the real-time fulfillment status of your delivery.</p>
          
          <form onSubmit={handleTrackOrder} style={{ display: "flex", gap: "10px", margin: "20px 0" }}>
            <input 
              type="text" 
              placeholder="e.g. GN-87B82C10" 
              value={trackingNumber} 
              onChange={e => setTrackingNumber(e.target.value)}
              minLength={6}
              maxLength={30}
              pattern="(?:GN|TG|TAIGA)-[A-Za-z0-9-]{3,24}"
              title="Enter a valid order reference, for example GN-87B82C10."
              style={{
                flex: 1,
                height: "44px",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                padding: "0 14px",
                fontSize: "13px",
                background: "var(--card-bg)"
              }}
              required
            />
            <button 
              type="submit" 
              style={{
                height: "44px",
                background: "var(--primary)",
                color: "#ffffff",
                padding: "0 24px",
                borderRadius: "var(--radius-md)",
                fontWeight: "750",
                fontSize: "13px"
              }}
              disabled={trackingLoading}
            >
              {trackingLoading ? "Searching..." : "Track Order"}
            </button>
          </form>

          {trackingError && <div className="checkout-error" style={{ marginBottom: "20px" }}>{trackingError}</div>}

          {trackedOrder && (
            <div className="animate-scale-up" style={{ marginTop: "20px", borderTop: "1px solid var(--border)", paddingTop: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
                <div>
                  <strong style={{ fontSize: "16px", color: "var(--foreground)" }}>{trackedOrder.order_number}</strong>
                  <span style={{ display: "block", fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>
                    Placed on {new Date(trackedOrder.created_at).toLocaleDateString()} at {new Date(trackedOrder.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span className={`status ${trackedOrder.status}`}>{trackedOrder.status}</span>
                  <strong style={{ display: "block", fontSize: "16px", color: "var(--primary)", marginTop: "4px" }}>
                    ₦{trackedOrder.total.toLocaleString()}
                  </strong>
                </div>
              </div>

              {/* Graphical Timeline */}
              {trackedOrder.status === "cancelled" ? (
                <div style={{ background: "var(--danger-light)", color: "var(--danger)", padding: "12px", borderRadius: "var(--radius-md)", fontSize: "13px", fontWeight: 600, textAlign: "center", marginBottom: "16px" }}>
                  This order was cancelled.
                </div>
              ) : (
                <div style={{ margin: "24px 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", position: "relative", paddingBottom: "10px" }}>
                    <div style={{ position: "absolute", top: "11px", left: "20px", right: "20px", height: "3px", background: "var(--border)", zIndex: 1 }} />
                    <div 
                      style={{ 
                        position: "absolute", 
                        top: "11px", 
                        left: "20px", 
                        height: "3px", 
                        background: "var(--primary)", 
                        zIndex: 2, 
                        transition: "width 0.4s ease",
                        width: 
                          trackedOrder.status === "pending" ? "0%" :
                          trackedOrder.status === "paid" ? "25%" :
                          trackedOrder.status === "processing" ? "50%" :
                          trackedOrder.status === "shipped" ? "75%" :
                          "100%"
                      }} 
                    />
                    
                    {[
                      { state: "pending", label: "Ordered", icon: ClipboardCheck },
                      { state: "paid", label: "Paid", icon: Zap },
                      { state: "processing", label: "Processing", icon: Clock },
                      { state: "shipped", label: "Shipped", icon: Truck },
                      { state: "delivered", label: "Delivered", icon: PackageCheck }
                    ].map((step, idx) => {
                      const Icon = step.icon;
                      const orderStatuses = ["pending", "paid", "processing", "shipped", "delivered"];
                      const currentIdx = orderStatuses.indexOf(trackedOrder.status);
                      const stepIdx = orderStatuses.indexOf(step.state);
                      const isCompleted = stepIdx <= currentIdx;
                      const isCurrent = stepIdx === currentIdx;

                      return (
                        <div key={step.state} style={{ display: "flex", flexDirection: "column", alignItems: "center", zIndex: 3, position: "relative", width: "70px" }}>
                          <div 
                            style={{ 
                              width: "26px", 
                              height: "26px", 
                              borderRadius: "50%", 
                              background: isCompleted ? "var(--primary)" : "var(--card-bg)", 
                              color: isCompleted ? "#ffffff" : "var(--muted-light)",
                              border: `2px solid ${isCompleted ? "var(--primary)" : "var(--border)"}`,
                              display: "grid", 
                              placeItems: "center",
                              boxShadow: isCurrent ? "0 0 0 4px rgba(16, 185, 129, 0.2)" : "none"
                            }}
                          >
                            <Icon size={12} />
                          </div>
                          <span style={{ fontSize: "10px", fontWeight: isCurrent ? "800" : "600", color: isCurrent ? "var(--foreground)" : "var(--muted)", marginTop: "6px", textAlign: "center", whiteSpace: "nowrap" }}>
                            {step.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Shipping info detail */}
              <div style={{ background: "var(--secondary)", borderRadius: "var(--radius-md)", padding: "16px", fontSize: "12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", textAlign: "left" }}>
                <div>
                  <h4 style={{ fontWeight: 800, textTransform: "uppercase", fontSize: "9px", color: "var(--muted)", letterSpacing: "0.05em", marginBottom: "6px" }}>Delivery address</h4>
                  <strong style={{ color: "var(--foreground)" }}>{trackedOrder.shipping_address?.first_name} {trackedOrder.shipping_address?.last_name}</strong>
                  <span style={{ display: "block", color: "var(--muted)", marginTop: "2px" }}>{trackedOrder.shipping_address?.line1}</span>
                  <span style={{ display: "block", color: "var(--muted)" }}>{trackedOrder.shipping_address?.city}, {trackedOrder.shipping_address?.state}</span>
                  <span style={{ display: "block", color: "var(--muted)" }}>{trackedOrder.shipping_address?.phone}</span>
                </div>
                <div>
                  <h4 style={{ fontWeight: 800, textTransform: "uppercase", fontSize: "9px", color: "var(--muted)", letterSpacing: "0.05em", marginBottom: "6px" }}>Shipping details</h4>
                  <p style={{ color: "var(--foreground)" }}>Method: <strong style={{ textTransform: "capitalize" }}>{trackedOrder.shipping_address?.delivery_method || "standard"}</strong></p>
                  <p style={{ color: "var(--muted)", marginTop: "4px" }}>
                    {trackedOrder.status === "delivered" 
                      ? "Your shipment was successfully delivered." 
                      : trackedOrder.status === "shipped" 
                      ? "Your shipment has left our warehouse and is in transit." 
                      : "We are packing your items and will hand them over to delivery partners shortly."}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="info-actions">
            <button onClick={() => setTrackerOpen(false)}>Close</button>
          </div>
        </section>
      </div>
    )}
  </div>;
}
