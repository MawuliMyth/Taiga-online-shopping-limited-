"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  ArrowLeft, BadgeCheck, CheckCircle2, ChevronLeft, ChevronRight, 
  Heart, MapPin, MessageCircle, Minus, PackageCheck, Plus, Share2, 
  ShieldCheck, ShoppingCart, Star, Truck, ShieldAlert, Award, X
} from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { useSessionTimeout } from "../../../lib/use-session-timeout";
import { AuthModal } from "../../components/AuthModal";

const money=(n:number)=>`₦${n.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const hiddenCustomerOptions=new Set(["Operating System"]);

export default function ProductPage(){
  const pathname=usePathname(),
        slug=decodeURIComponent(pathname?.split("/").filter(Boolean).pop()??"");
  
  const [product,setProduct]=useState<any>(null),
        [related,setRelated]=useState<any[]>([]),
        [qty,setQty]=useState(1),
        [imageIndex,setImageIndex]=useState(0),
        [saved,setSaved]=useState(false),
        [loading,setLoading]=useState(true),
        [auth,setAuth]=useState(false),
        [authReason,setAuthReason]=useState("Please sign in first to continue."),
        [notice,setNotice]=useState(""),
        [supportPhone,setSupportPhone]=useState("0800 466 3639"),
        [selectedOptions,setSelectedOptions]=useState<Record<string,string>>({}),
        [reviews,setReviews]=useState<any[]>([]),
        [canReview,setCanReview]=useState(false),
        [reviewRating,setReviewRating]=useState(5),
        [reviewBusy,setReviewBusy]=useState(false),
        [zoomOpen,setZoomOpen]=useState(false);
  useSessionTimeout(60,()=>{setAuthReason("Your session timed out after 60 minutes of inactivity. Please sign in again.");setAuth(true)});

  // Product page enhancements states
  const [activeTab, setActiveTab] = useState<"details" | "specs" | "warranty">("details");
  const [showStickyBar, setShowStickyBar] = useState(false);
  const zoomImageCount=Math.max(1,product?.product_images?.length||1);

  useEffect(()=>{
    if(!slug){setLoading(false);return};
    setLoading(true);
    (async()=>{
      const {data,error}=await supabase.from("products").select("*,categories(name)").eq("slug",slug).eq("is_active",true).maybeSingle();
      if(error||!data){
        setProduct(null);
        setLoading(false);
        return;
      }
      const {data:gallery}=await supabase.from("product_images").select("image_url,alt_text,sort_order").eq("product_id",data.id).order("sort_order");
      const {data:reviewRows}=await supabase.from("product_reviews").select("id,user_id,reviewer_name,rating,title,body,created_at").eq("product_id",data.id).order("created_at",{ascending:false});
      setReviews(reviewRows??[]);
      setProduct({...data,product_images:gallery??[]});
      setSelectedOptions({});
      setLoading(false);
      
      const {data:r}=await supabase.from("products").select("id,slug,name,price,image_url,badge").eq("category_id",data.category_id).eq("is_active",true).neq("id",data.id).limit(5);
      setRelated(r??[]);
      
      // Check if product is in wishlist
      const {data:{session}}=await supabase.auth.getSession();
      if(session?.user){
        const {data:fav}=await supabase.from("wishlist_items").select("*").eq("user_id",session.user.id).eq("product_id",data.id).maybeSingle();
        if(fav) setSaved(true);
        const {data:purchases}=await supabase.from("orders").select("id,order_items!inner(product_id)").eq("user_id",session.user.id).not("paid_at","is",null).neq("status","cancelled").eq("order_items.product_id",data.id).limit(1);
        setCanReview(Boolean(purchases?.length));
      }
    })();
  },[slug]);

  useEffect(()=>{
    const loadSupportPhone=()=>supabase.from("store_settings").select("support_phone").eq("id",1).maybeSingle().then(({data})=>{
      if(data?.support_phone)setSupportPhone(data.support_phone);
    });
    loadSupportPhone();
    window.addEventListener("focus",loadSupportPhone);
    return()=>window.removeEventListener("focus",loadSupportPhone);
  },[]);

  // Monitor scroll for mobile sticky checkout bar
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 480) {
        setShowStickyBar(true);
      } else {
        setShowStickyBar(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(()=>{
    if(!zoomOpen)return;
    const keydown=(event:KeyboardEvent)=>{
      if(event.key==="Escape")setZoomOpen(false);
      if(event.key==="ArrowLeft")setImageIndex(index=>(index-1+zoomImageCount)%zoomImageCount);
      if(event.key==="ArrowRight")setImageIndex(index=>(index+1)%zoomImageCount);
    };
    window.addEventListener("keydown",keydown);
    return()=>window.removeEventListener("keydown",keydown);
  },[zoomOpen,zoomImageCount]);

  async function add(){
    const variants=Array.isArray(product.variants)?product.variants.filter((variant:any)=>variant.active!==false):[];
    const optionNames=Array.from(new Set(variants.flatMap((variant:any)=>Object.keys(variant.options||{})))) as string[];
    const customerOptionNames=optionNames.filter(name=>!hiddenCustomerOptions.has(name));
    const matches=variants.filter((variant:any)=>customerOptionNames.every(name=>variant.options?.[name]===selectedOptions[name]));
    const selectedVariant=matches.find((variant:any)=>Number(variant.inventory)>0)??matches[0];
    if(variants.length&&!selectedVariant){setNotice(`Choose ${customerOptionNames.filter(name=>!selectedOptions[name]).join(", ")||"an available combination"} before adding to cart`);setTimeout(()=>setNotice(""),3000);return}
    const available=selectedVariant?Number(selectedVariant.inventory):Number(product.inventory);
    if(available<1){setNotice("This selection is currently out of stock");setTimeout(()=>setNotice(""),2500);return}
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){
      setAuthReason("Please sign in first to add this product to your cart.");
      setAuth(true);
      return;
    }
    const variantKey=selectedVariant?.id||"default";
    const selectedVariantSnapshot=selectedVariant?{id:selectedVariant.id,sku:selectedVariant.sku||null,options:selectedVariant.options,price:selectedVariant.price??product.price,image_url:selectedVariant.image_url||null}:null;
    const {data:row}=await supabase.from("cart_items").select("quantity").eq("user_id",user.id).eq("product_id",product.id).eq("variant_key",variantKey).maybeSingle();
    const result=row
      ? await supabase.from("cart_items").update({quantity:Math.min(row.quantity+qty,available),selected_variant:selectedVariantSnapshot}).eq("user_id",user.id).eq("product_id",product.id).eq("variant_key",variantKey)
      : await supabase.from("cart_items").insert({user_id:user.id,product_id:product.id,variant_key:variantKey,selected_variant:selectedVariantSnapshot,quantity:Math.min(qty,available)});
    setNotice(result.error?result.error.message:`${qty} item${qty>1?"s":""} added to cart`);
    setTimeout(()=>setNotice(""),2500);
  }

  async function shareProduct(){
    const shareData={
      title:product.name,
      text:`Check out ${product.name} on Taiga Online Shopping Limited`,
      url:window.location.href
    };
    try{
      if(navigator.share) await navigator.share(shareData);
      else{
        await navigator.clipboard.writeText(window.location.href);
        setNotice("Product link copied");
      }
    }catch{}
    setTimeout(()=>setNotice(""),2200);
  }

  async function saveProduct(){
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){
      setAuthReason("Please sign in first to save this product to your wishlist.");
      setAuth(true);
      return;
    }
    if(saved){
      await supabase.from("wishlist_items").delete().eq("user_id",user.id).eq("product_id",product.id);
      setSaved(false);
      setNotice("Removed from saved items");
    }else{
      await supabase.from("wishlist_items").upsert({user_id:user.id,product_id:product.id});
      setSaved(true);
      setNotice("Saved to your wishlist");
    }
    setTimeout(()=>setNotice(""),2200);
  }

  async function submitReview(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){setAuthReason("Please sign in to review a product you purchased.");setAuth(true);return}
    const form=new FormData(event.currentTarget),title=String(form.get("title")||"").trim(),body=String(form.get("body")||"").trim();
    setReviewBusy(true);
    const payload={product_id:product.id,user_id:user.id,reviewer_name:user.user_metadata?.full_name||user.email?.split("@")[0]||"Taiga customer",rating:reviewRating,title,body,updated_at:new Date().toISOString()};
    const {error}=await supabase.from("product_reviews").upsert(payload,{onConflict:"product_id,user_id"});
    if(error){setNotice(error.message.includes("row-level security")?"Only customers who purchased this product can review it.":error.message)}else{
      const {data}=await supabase.from("product_reviews").select("id,user_id,reviewer_name,rating,title,body,created_at").eq("product_id",product.id).order("created_at",{ascending:false});setReviews(data??[]);event.currentTarget.reset();setReviewRating(5);setNotice("Thank you — your verified review is now live");
    }
    setReviewBusy(false);setTimeout(()=>setNotice(""),3000);
  }

  if(loading) return <div className="product-loading product-shimmer" aria-label="Loading product"><div/><div><span/><span/><span/><span/></div></div>;
  if(!product) return <div className="product-loading"><h2>Product not found</h2><Link href="/">Return to store</Link></div>;

  const variants=Array.isArray(product.variants)?product.variants.filter((variant:any)=>variant.active!==false):[],
        optionNames=Array.from(new Set(variants.flatMap((variant:any)=>Object.keys(variant.options||{})))) as string[],
        customerOptionNames=optionNames.filter(name=>!hiddenCustomerOptions.has(name)),
        matchingVariants=variants.filter((variant:any)=>customerOptionNames.every(name=>variant.options?.[name]===selectedOptions[name])),
        selectedVariant=matchingVariants.find((variant:any)=>Number(variant.inventory)>0)??matchingVariants[0],
        price=Number(selectedVariant?.price??product.price),
        old=Number(product.compare_at_price??price),
        discount=old>price?Math.round((old-price)/old*100):0,
        availableInventory=selectedVariant?Number(selectedVariant.inventory):variants.length?variants.reduce((sum:number,variant:any)=>sum+Number(variant.inventory||0),0):Number(product.inventory),
        gallery=(product.product_images??[]).sort((a:any,b:any)=>a.sort_order-b.sort_order).map((i:any)=>i.image_url).filter(Boolean),
        images=Array.from(new Set([...(gallery.length?gallery:[product.image_url]),...variants.map((variant:any)=>variant.image_url).filter(Boolean)])) as string[],
        averageRating=reviews.length?Number((reviews.reduce((sum,review)=>sum+Number(review.rating),0)/reviews.length).toFixed(1)):0,
        ratingDistribution=[5,4,3,2,1].map(stars=>({stars,pct:reviews.length?Math.round(reviews.filter(review=>Number(review.rating)===stars).length/reviews.length*100):0}));

  return <div className="product-page">{auth&&<AuthModal reason={authReason} onClose={()=>setAuth(false)}/>} {notice&&<div className="toast">{notice}</div>}
    <header className="product-top"><Link href="/" className="logo"><span>T</span>Taiga<small>MARKET</small></Link><Link href="/"><ArrowLeft/> Continue shopping</Link><Link href="/?panel=cart"><ShoppingCart/> Cart</Link></header>
    <main className="product-wrap">
      <nav className="breadcrumbs"><Link href="/">Home</Link><span>›</span><Link href="/#categories">{product.categories?.name}</Link><span>›</span><b>{product.name}</b></nav>
      
      <section className="product-overview">
        <div className="product-gallery">
          <span>{product.badge}</span>
          <div className="carousel-stage" role="button" tabIndex={0} aria-label={`Zoom product image ${imageIndex+1} of ${images.length}`} onClick={()=>setZoomOpen(true)} onKeyDown={event=>(event.key==="Enter"||event.key===" ")&&setZoomOpen(true)}>
            <img src={images[imageIndex]} alt={`${product.name} image ${imageIndex+1}`}/>
            <small className="carousel-counter">{imageIndex+1}/{images.length}</small>
            {images.length>1&&<>
              <button className="carousel-prev" onClick={event=>{event.stopPropagation();setImageIndex(i=>(i-1+images.length)%images.length)}} aria-label="Previous image"><ChevronLeft/></button>
              <button className="carousel-next" onClick={event=>{event.stopPropagation();setImageIndex(i=>(i+1)%images.length)}} aria-label="Next image"><ChevronRight/></button>
            </>}
          </div>
          {images.length>1&&<div className="carousel-thumbs">
            {images.map((url:string,index:number)=><button className={imageIndex===index?"active":""} onClick={()=>setImageIndex(index)} key={`${url}-${index}`} aria-label={`Show image ${index+1}`}><img src={url} alt=""/></button>)}
          </div>}
          <div className="product-social-actions">
            <button onClick={shareProduct}><Share2/> Share Product</button>
            <button className={saved?"saved":""} onClick={saveProduct}><Heart fill={saved?"currentColor":"none"}/> {saved?"Saved to Wishlist":"Save to Wishlist"}</button>
          </div>
        </div>
        
        <div className="product-info">
          <div className="product-flags">
            <span><BadgeCheck/> Official store</span>
            <span><Truck/> Nationwide delivery</span>
          </div>
          
          <h1 style={{ fontSize: "28px", fontWeight: 800, marginTop: "16px", color: "var(--foreground)" }}>{product.name}</h1>
          <p style={{ marginTop: "8px", fontSize: "13px", color: "var(--muted)" }}>Brand: <strong style={{ color: "var(--foreground)" }}>Taiga Select</strong> · <a href="#related" style={{ color: "var(--primary)", fontWeight: "650" }}>View similar products</a></p>
          
          <div className="detail-price" style={{ marginTop: "20px" }}>
            <strong style={{ fontSize: "32px", fontWeight: 900 }}>{money(price)}</strong>
            {old>price&&<>
              <del style={{ fontSize: "16px", color: "var(--muted-light)" }}>{money(old)}</del>
              <span style={{ background: "var(--danger-light)", color: "var(--danger)", padding: "4px 8px", borderRadius: "var(--radius-sm)", fontSize: "12px", fontWeight: 800 }}>-{discount}%</span>
            </>}
          </div>
          
          <small className="units-left" style={{ display: "block", marginTop: "8px", fontWeight: "750", color: availableInventory <= 5 ? "var(--danger)" : "var(--primary)" }}>
            {availableInventory === 0 ? "Out of Stock" : selectedVariant&&availableInventory <= 5 ? `Only ${availableInventory} of this option left — order soon` : selectedVariant?`${availableInventory} of this option in stock`:variants.length?"Choose your options to see exact availability":`${availableInventory} units in stock` }
          </small>
          
          <div className="detail-rating" style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "16px", fontSize: "13px" }}>
            <span style={{ display: "flex", color: "#fbbe24" }}>
              {[1,2,3,4,5].map(i=><Star key={i} size={14} fill={i<=Math.round(averageRating)?"currentColor":"none"}/>)}
            </span>
            <a href="#reviews" style={{ color: "var(--primary)", fontWeight: "650" }}>{reviews.length?`${averageRating} · ${reviews.length} verified customer review${reviews.length===1?"":"s"}`:"No customer ratings yet"}</a>
          </div>

          {variants.length>0&&<div className="product-options" aria-label="Product options">{customerOptionNames.map(optionName=>{
            const values=Array.from(new Set(variants.map((variant:any)=>variant.options?.[optionName]).filter(Boolean))) as string[];
            return <fieldset key={optionName}><legend>{optionName} <span>{selectedOptions[optionName]||"Select one"}</span></legend><div>{values.map(value=>{
              const possible=variants.some((variant:any)=>variant.options?.[optionName]===value&&Object.entries(selectedOptions).every(([key,selected])=>key===optionName||!selected||variant.options?.[key]===selected)&&Number(variant.inventory)>0);
              return <button type="button" key={value} className={selectedOptions[optionName]===value?"selected":""} disabled={!possible} onClick={()=>{setSelectedOptions(current=>({...current,[optionName]:value}));setQty(1);const match=variants.find((variant:any)=>variant.options?.[optionName]===value&&Object.entries(selectedOptions).every(([key,selected])=>key===optionName||!selected||variant.options?.[key]===selected));if(match?.image_url){const nextIndex=images.indexOf(match.image_url);if(nextIndex>=0)setImageIndex(nextIndex)}}}>{value}</button>})}</div></fieldset>})}</div>}
          
          <div className="buy-row" style={{ display: "flex", gap: "16px", marginTop: "28px" }}>
            <div className="detail-qty" style={{ display: "flex", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", overflow: "hidden", background: "var(--secondary)" }}>
              <button onClick={()=>setQty(Math.max(1,qty-1))} style={{ width: "40px", height: "44px" }}><Minus/></button>
              <span style={{ width: "44px", display: "grid", placeItems: "center", fontSize: "14px", fontWeight: "750" }}>{qty}</span>
              <button onClick={()=>setQty(Math.min(availableInventory||1,qty+1))} style={{ width: "40px", height: "44px" }}><Plus/></button>
            </div>
            <button className="add-main" onClick={add} disabled={availableInventory===0} style={{ flex: 1, height: "44px" }}>
              <ShoppingCart/> Add to cart
            </button>
          </div>
          
          <div className="buyer-help" style={{ display: "flex", gap: "12px", background: "var(--secondary)", padding: "16px", borderRadius: "var(--radius-md)", marginTop: "24px" }}>
            <MessageCircle style={{ color: "var(--primary)" }} />
            <div>
              <span style={{ fontWeight: 700, fontSize: "13px", color: "var(--foreground)" }}>Need help placing your order?</span>
              <small style={{ display: "block", color: "var(--muted)", marginTop: "2px" }}>Call or WhatsApp {supportPhone}</small>
            </div>
          </div>
        </div>
      </section>

      {/* Tabs Layout for description, specifications, and warranty info */}
      <section className="detail-section" style={{ padding: "0", border: "0", background: "transparent", boxShadow: "none", marginTop: "32px" }}>
        <div style={{ display: "flex", borderBottom: "2px solid var(--border)", gap: "24px", marginBottom: "20px" }}>
          {[
            { id: "details", label: "Product Details" },
            { id: "specs", label: "Specifications" },
            { id: "warranty", label: "Warranty & Returns" }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                padding: "12px 4px",
                fontSize: "14px",
                fontWeight: "750",
                color: activeTab === tab.id ? "var(--primary)" : "var(--muted)",
                borderBottom: `2.5px solid ${activeTab === tab.id ? "var(--primary)" : "transparent"}`,
                marginBottom: "-2px"
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "32px", boxShadow: "var(--shadow-sm)" }} className="animate-scale-up">
          {activeTab === "details" && (
            <div>
              <p style={{ fontSize: "14px", lineHeight: "1.6", color: "var(--muted)" }}>
                {product.description||`${product.name} combines dependable everyday performance with quality materials and thoughtful design. It is supplied by Taiga Online Shopping Limited with buyer protection, nationwide delivery and responsive local support.`}
              </p>
              <img src={product.image_url} alt={`${product.name} detail`} style={{ display: "block", maxWidth: "100%", maxHeight: "380px", objectFit: "contain", borderRadius: "var(--radius-md)", margin: "24px auto 0" }} />
            </div>
          )}

          {activeTab === "specs" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
              <article style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "20px", background: "var(--secondary)" }}>
                <h3 style={{ fontSize: "12px", textTransform: "uppercase", fontWeight: "800", color: "var(--foreground)", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}><Award size={14} /> Product specifications</h3>
                {Object.keys(product.specifications||{}).length?<dl className="product-spec-list">{Object.entries(product.specifications).map(([name,value])=><div key={name}><dt>{name}</dt><dd>{String(value)}</dd></div>)}</dl>:<p style={{fontSize:12,color:"var(--muted)"}}>No additional specifications have been published for this product.</p>}
              </article>
              
              <article style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "20px", background: "var(--secondary)" }}>
                <h3 style={{ fontSize: "12px", textTransform: "uppercase", fontWeight: "800", color: "var(--foreground)", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}><ShieldCheck size={14} /> Product Information</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12px", color: "var(--muted)" }}>
                  <p><b>SKU:</b> {String(product.id).slice(0,12).toUpperCase()}</p>
                  <p><b>Category:</b> {product.categories?.name}</p>
                  <p><b>Stock availability:</b> {product.inventory} units available</p>
                  <p><b>Variants:</b> {variants.length?`${variants.length} available combinations`:"Standard product"}</p>
                </div>
              </article>
            </div>
          )}

          {activeTab === "warranty" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
              <article style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "20px", background: "var(--secondary)" }}>
                <h3 style={{ fontSize: "12px", textTransform: "uppercase", fontWeight: "800", color: "var(--foreground)", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}><ShieldCheck size={14} /> Warranty Terms</h3>
                <p style={{ fontSize: "12px", color: "var(--muted)", lineHeight: "1.5" }}>{Number(product.warranty_value)>0?`This product includes a ${product.warranty_value}-${String(product.warranty_unit||"months").replace(/s$/,'')} warranty from the purchase date.`:"No seller warranty is provided for this product."}</p>
                {product.warranty_notes&&<p style={{ fontSize: "12px", color: "var(--muted)", lineHeight: "1.5", marginTop:10 }}>{product.warranty_notes}</p>}
              </article>

              <article style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "20px", background: "var(--secondary)" }}>
                <h3 style={{ fontSize: "12px", textTransform: "uppercase", fontWeight: "800", color: "var(--foreground)", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}><Truck size={14} /> Return eligibility</h3>
                {product.returnable!==false?<><p style={{ fontSize: "12px", color: "var(--muted)", lineHeight: "1.5" }}>To qualify for a return, this item must:</p><ul className="product-return-list"><li>Be unused, undamaged and in resellable condition</li><li>Include all original packaging, accessories, manuals and tags</li><li>Be returned within the applicable return window</li></ul><p className="return-warning">Items showing use, damage or tampering do not qualify for a refund.</p></>:<p style={{ fontSize: "12px", color: "var(--muted)", lineHeight: "1.5" }}>This product is not returnable. Any applicable seller warranty shown alongside still remains valid.</p>}
              </article>
            </div>
          )}
        </div>
      </section>

      {related.length>0&&<section className="related-section" id="related" style={{ marginTop: "32px" }}>
        <h2>Customers who viewed this also viewed</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "16px" }}>
          {related.map(r=><Link href={`/product/${r.slug}`} key={r.id} style={{ display: "flex", flexDirection: "column", gap: "8px" }} className="related-card">
            <img src={r.image_url} alt="" style={{ width: "100%", height: "140px", objectFit: "contain", padding:"10px", borderRadius: "var(--radius-md)", background: "white" }} />
            <strong style={{ fontSize: "13px", color: "var(--foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</strong>
            <span style={{ fontSize: "13px", fontWeight: "800", color: "var(--primary)" }}>{money(Number(r.price))}</span>
          </Link>)}
        </div>
      </section>}

      <section className="review-section" id="reviews" style={{ marginTop: "32px", display: "grid", gridTemplateColumns: "260px 1fr", gap: "32px" }}>
        <h2 style={{ gridColumn: "1 / -1", marginBottom: "0" }}>Verified Customer Feedback</h2>
        
        <div className="review-summary" style={{ background: "var(--secondary)", borderRadius: "var(--radius-lg)", padding: "24px", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <strong style={{ fontSize: "36px", fontWeight: 900 }}>{averageRating.toFixed(1)}/5</strong>
          <span style={{ display: "flex", color: "#fbbe24", margin: "8px 0" }}>
            {[1,2,3,4,5].map(i=><Star key={i} size={14} fill={i<=Math.round(averageRating)?"currentColor":"none"}/>)}
          </span>
          <small style={{ fontSize: "11px", color: "var(--muted)" }}>{reviews.length?`Based on ${reviews.length} verified purchase${reviews.length===1?"":"s"}`:"Be the first verified buyer to review"}</small>
 
          {/* Rating Distribution Progress Chart */}
          <div style={{ width: "100%", marginTop: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
            {ratingDistribution.map((r: any) => (
              <div key={r.stars} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: "var(--muted)" }}>
                <span style={{ width: "8px", fontWeight: "700" }}>{r.stars}</span>
                <Star size={10} fill="currentColor" style={{ color: "#fbbe24" }} />
                <div style={{ flex: 1, height: "6px", background: "var(--border)", borderRadius: "var(--radius-full)", overflow: "hidden" }}>
                  <div style={{ width: `${r.pct}%`, height: "100%", background: "#fbbe24", borderRadius: "var(--radius-full)" }} />
                </div>
                <span style={{ width: "24px", textAlign: "right" }}>{r.pct}%</span>
              </div>
            ))}
          </div>
        </div>
 
        <div className="reviews" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {canReview&&<form className="review-form" onSubmit={submitReview}><div><strong>Rate your purchase</strong><span>{[1,2,3,4,5].map(star=><button type="button" key={star} onClick={()=>setReviewRating(star)} aria-label={`${star} star${star===1?"":"s"}`}><Star fill={star<=reviewRating?"currentColor":"none"}/></button>)}</span></div><label>Review title<input name="title" minLength={3} maxLength={100} required placeholder="Summarize your experience"/></label><label>Your review<textarea name="body" minLength={10} maxLength={1200} required placeholder="Tell other customers about the product"/></label><button disabled={reviewBusy}>{reviewBusy?"Publishing…":"Publish verified review"}</button></form>}
          {!canReview&&<div className="review-eligibility"><ShieldCheck/><span><strong>Reviews are purchase-verified</strong><small>Only customers who completed an order for this product can submit a rating.</small></span></div>}
          {reviews.length===0&&<div className="review-empty"><Star/><strong>No customer reviews yet</strong><p>Verified ratings will appear here after customers receive and review their purchases.</p></div>}
          {reviews.map((rev: any) => (
            <article key={rev.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: "16px" }}>
              <span style={{ color: "#fbbe24", letterSpacing: "2px" }}>
                {"★".repeat(rev.rating)}{"☆".repeat(5 - rev.rating)}
              </span>
              <strong style={{ display: "block", fontSize: "13px", fontWeight: 700, margin: "6px 0" }}>{rev.title}</strong>
              <p style={{ fontSize: "13px", color: "var(--muted)", lineHeight: 1.5 }}>{rev.body}</p>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px" }}>
                <small style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--primary)", fontWeight: 700, fontSize: "11px" }}><CheckCircle2 size={12}/> Verified Purchase by {rev.reviewer_name}</small>
                <small style={{ fontSize: "11px", color: "var(--muted)" }}>{new Date(rev.created_at).toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"})}</small>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>

    {zoomOpen&&<div className="product-lightbox" role="dialog" aria-modal="true" aria-label={`${product.name} image viewer`} onMouseDown={event=>event.target===event.currentTarget&&setZoomOpen(false)}><button className="lightbox-close" onClick={()=>setZoomOpen(false)} aria-label="Close image viewer"><X/></button><div className="lightbox-stage"><img src={images[imageIndex]} alt={`${product.name} enlarged image ${imageIndex+1}`}/><strong>{imageIndex+1}/{images.length}</strong>{images.length>1&&<><button className="lightbox-prev" onClick={()=>setImageIndex(index=>(index-1+images.length)%images.length)} aria-label="Previous image"><ChevronLeft/></button><button className="lightbox-next" onClick={()=>setImageIndex(index=>(index+1)%images.length)} aria-label="Next image"><ChevronRight/></button></>}</div>{images.length>1&&<div className="lightbox-thumbs">{images.map((url:string,index:number)=><button className={imageIndex===index?"active":""} onClick={()=>setImageIndex(index)} key={`${url}-zoom-${index}`} aria-label={`View image ${index+1}`}><img src={url} alt=""/></button>)}</div>}</div>}

    {/* Mobile Sticky Checkout Action Bar */}
    {showStickyBar && (
      <div 
        style={{ 
          position: "fixed", 
          bottom: 0, 
          left: 0, 
          right: 0, 
          background: "var(--glass-bg)", 
          backdropFilter: "blur(var(--glass-blur))", 
          WebkitBackdropFilter: "blur(var(--glass-blur))",
          borderTop: "1px solid var(--glass-border)", 
          padding: "12px max(20px, calc((100% - 1320px)/2))", 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center", 
          zIndex: 80, 
          boxShadow: "var(--shadow-lg)" 
        }} 
        className="animate-slide-in-bottom"
      >
        <div style={{ display: "flex", gap: "12px", alignItems: "center", minWidth: 0 }}>
          <img src={images[0]} alt="" style={{ width: "40px", height: "40px", objectFit: "cover", borderRadius: "var(--radius-sm)" }} />
          <div style={{ minWidth: 0 }}>
            <strong style={{ fontSize: "13px", display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "var(--foreground)" }}>{product.name}</strong>
            <span style={{ fontSize: "12px", color: "var(--primary)", fontWeight: "750" }}>{money(price)}</span>
          </div>
        </div>
        <button 
          onClick={add} 
          disabled={product.inventory===0}
          style={{ 
            background: "var(--primary)", 
            color: "#ffffff", 
            padding: "10px 18px", 
            borderRadius: "var(--radius-md)", 
            fontSize: "12px", 
            fontWeight: "750", 
            display: "flex", 
            alignItems: "center", 
            gap: "8px",
            boxShadow: "0 4px 10px rgba(13, 122, 95, 0.2)"
          }}
        >
          <ShoppingCart size={14} /> Add to Cart
        </button>
      </div>
    )}
  </div>;
}
