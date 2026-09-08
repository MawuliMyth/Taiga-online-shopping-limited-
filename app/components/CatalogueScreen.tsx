"use client";
/* eslint-disable @next/next/no-img-element -- Catalogue media is supplied dynamically and optimized at upload time. */

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { ArrowLeft, Heart, Search, ShoppingCart, SlidersHorizontal, Star } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { availableProductStock, nextCartQuantity, visibleProductBadge } from "../../lib/product-rules";
import { AuthModal } from "./AuthModal";
import { StorePanels } from "./StorePanels";

type Product={id:string;slug:string;name:string;category:string;price:number;old:number;rating:number;badge:string;image:string;inventory:number;variants:any[];createdAt:string};
const aliases:Record<string,string>={Computing:"Computers and Accessories",Mobile:"Phones and tablets",Groceries:"Drinks and Groceries",Beauty:"Others"};

export function CatalogueScreen({mode}:{mode:"search"|"shop"}){
  const params=useSearchParams(),router=useRouter();
  const [cartOpen,setCartOpen]=useState(false);
  const [query,setQuery]=useState(params.get("q")??"");
  const [category,setCategory]=useState(params.get("category")??"All");
  const [sort,setSort]=useState(params.get("sort")??"relevance"),[products,setProducts]=useState<Product[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
  const [user,setUser]=useState<User|null>(null),[authReason,setAuthReason]=useState("Please sign in first to continue."),[showAuth,setShowAuth]=useState(false),[wishlist,setWishlist]=useState<Set<string>>(new Set()),[cartCount,setCartCount]=useState(0),[notice,setNotice]=useState("");

  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>setUser(data.session?.user??null));
    const {data:listener}=supabase.auth.onAuthStateChange((_event,session)=>{setUser(session?.user??null);if(session?.user)setShowAuth(false)});
    supabase.from("products").select("id,slug,name,price,compare_at_price,rating,badge,image_url,inventory,variants,created_at,categories(name)").eq("is_active",true).order("created_at",{ascending:false}).then(({data,error:loadError})=>{
      if(loadError)setError("The catalogue could not be loaded. Please try again shortly.");
      else setProducts((data??[]).map((p:any)=>({id:p.id,slug:p.slug,name:p.name,category:aliases[p.categories?.name]??p.categories?.name??"Others",price:Number(p.price),old:Number(p.compare_at_price??p.price),rating:Number(p.rating),badge:visibleProductBadge(p.badge,p.created_at),image:p.image_url,inventory:Number(p.inventory??0),variants:Array.isArray(p.variants)?p.variants:[],createdAt:p.created_at})));
      setLoading(false);
    });
    return()=>listener.subscription.unsubscribe();
  },[]);
  useEffect(()=>{if(!user){setWishlist(new Set());setCartCount(0);return}Promise.all([supabase.from("wishlist_items").select("product_id").eq("user_id",user.id),supabase.from("cart_items").select("quantity").eq("user_id",user.id)]).then(([wishResult,cartResult])=>{setWishlist(new Set(wishResult.data?.map(row=>String(row.product_id))??[]));setCartCount(cartResult.data?.reduce((sum,row)=>sum+Number(row.quantity||0),0)??0)})},[user]);

  const categories=useMemo(()=>["All",...Array.from(new Set(products.map(p=>p.category))).sort()], [products]);
  const results=useMemo(()=>{
    const terms=query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const filtered=products.filter(p=>(category==="All"||p.category===category)&&(!terms.length||terms.every(term=>`${p.name} ${p.category}`.toLowerCase().includes(term))));
    const discountRate=(product:Product)=>product.old>product.price?(product.old-product.price)/product.old:0;
    return [...filtered].sort((a,b)=>sort==="price-low"?a.price-b.price:sort==="price-high"?b.price-a.price:sort==="rating"?b.rating-a.rating:sort==="new"?new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime():sort==="deals"?discountRate(b)-discountRate(a):0);
  },[products,query,category,sort]);
  function submit(event:FormEvent){event.preventDefault();const next=new URLSearchParams();if(query.trim())next.set("q",query.trim());if(category!=="All")next.set("category",category);router.push(`/search?${next.toString()}`)}
  async function like(product:Product){if(!user){setAuthReason("Please sign in first to save products to your wishlist.");setShowAuth(true);return}const removing=wishlist.has(product.id),result=removing?await supabase.from("wishlist_items").delete().eq("user_id",user.id).eq("product_id",product.id):await supabase.from("wishlist_items").insert({user_id:user.id,product_id:product.id});if(result.error){setNotice("Saved items could not be updated yet.");window.setTimeout(()=>setNotice(""),2200);return}const next=new Set(wishlist);if(removing)next.delete(product.id);else next.add(product.id);setWishlist(next)}
  async function add(product:Product){if(!user){setAuthReason("Please sign in first to add products to your cart.");setShowAuth(true);return}if(product.variants.length){router.push(`/product/${product.slug}`);return}const available=availableProductStock(product);if(available<1){setNotice("This product is currently out of stock.");window.setTimeout(()=>setNotice(""),2200);return}const existing=await supabase.from("cart_items").select("quantity").eq("user_id",user.id).eq("product_id",product.id).maybeSingle();if(existing.error){setNotice("Cart could not be checked yet.");window.setTimeout(()=>setNotice(""),2200);return}const current=Number(existing.data?.quantity??0),next=nextCartQuantity(current,1,available);if(next<=current){setNotice("You already have the maximum available quantity in your cart.");window.setTimeout(()=>setNotice(""),2200);return}const result=existing.data?await supabase.from("cart_items").update({quantity:next,updated_at:new Date().toISOString()}).eq("user_id",user.id).eq("product_id",product.id):await supabase.from("cart_items").insert({user_id:user.id,product_id:product.id,quantity:next});if(!result.error)setCartCount(count=>count+(next-current));setNotice(result.error?"Cart could not be updated yet.":"Added to your cart");window.setTimeout(()=>setNotice(""),2200)}

  return <div className="catalogue-page">{showAuth&&<AuthModal reason={authReason} onClose={()=>setShowAuth(false)}/>} {notice&&<div className="toast">{notice}</div>}
    <header className="catalogue-header"><div className="wrap"><Link href="/" className="logo"><span>T</span>Taiga<small>MARKET</small></Link><form onSubmit={submit}><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search products, brands and categories" aria-label="Search products"/><button>Search</button></form><button type="button" onClick={()=>{setCartOpen(true);if(!user){setAuthReason("Please sign in to open your cart.");setShowAuth(true)}}} className="catalogue-cart" aria-label={`Cart${cartCount>0?`, ${cartCount} item${cartCount===1?"":"s"}`:""}`}><ShoppingCart/> Cart{cartCount>0&&<b data-count={cartCount}>{cartCount}</b>}</button></div></header>
    {cartOpen&&user&&<StorePanels kind="cart" user={user} onClose={()=>setCartOpen(false)} onChanged={()=>{void supabase.from("cart_items").select("quantity").eq("user_id",user.id).then(({data})=>setCartCount(data?.reduce((sum,row)=>sum+Number(row.quantity||0),0)??0))}}/>}
    <main className="wrap catalogue-main"><nav className="catalogue-breadcrumb"><Link href="/"><ArrowLeft/> Home</Link><span>/</span><strong>{mode==="search"?"Search results":"All products"}</strong></nav>
      <section className="catalogue-title"><div><span>{mode==="search"?"Product search":"Explore Taiga"}</span><h1>{mode==="search"?(query?`Results for “${query}”`:"Search products"):category==="All"?"All products":category}</h1><p>{loading?"Searching the catalogue…":`${results.length} ${results.length===1?"product":"products"} found`}</p></div></section>
      <div className="catalogue-layout"><aside><div className="catalogue-filter-title"><SlidersHorizontal/> Filters</div><label>Category<select value={category} onChange={e=>{setCategory(e.target.value);const next=new URLSearchParams(params.toString());if(e.target.value==="All")next.delete("category");else next.set("category",e.target.value);router.push(`${mode==="shop"?"/shop":"/search"}?${next}`)}}>{categories.map(item=><option key={item}>{item}</option>)}</select></label><Link href="/shop">Clear filters</Link></aside>
        <section className="catalogue-results"><div className="catalogue-toolbar"><span>Showing {results.length} results</span><label>Sort by <select value={sort} onChange={e=>setSort(e.target.value)}><option value="relevance">Relevance</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="rating">Customer rating</option></select></label></div>
          {loading?<div className="catalogue-screen-loading"><span/><span/><span/></div>:error?<div className="catalogue-empty"><h2>Catalogue unavailable</h2><p>{error}</p><button onClick={()=>location.reload()}>Try again</button></div>:results.length?<div className="catalogue-product-grid">{results.map(product=>{const outOfStock=availableProductStock(product)<1;return <article key={product.id}><div className="catalogue-product-image">{product.badge&&<span>{product.badge}</span>}<button onClick={()=>like(product)} aria-label={`Save ${product.name}`} className={wishlist.has(product.id)?"liked":""}><Heart fill={wishlist.has(product.id)?"currentColor":"none"}/></button><Link href={`/product/${product.slug}`}><img src={product.image} alt={product.name}/></Link></div><small>{product.category}</small><h2><Link href={`/product/${product.slug}`}>{product.name}</Link></h2><div className="catalogue-rating"><Star fill={product.rating>0?"currentColor":"none"}/> {product.rating>0?product.rating.toFixed(1):"Not rated"}</div><div className="catalogue-price"><strong>₦{product.price.toLocaleString()}</strong>{product.old>product.price&&<del>₦{product.old.toLocaleString()}</del>}<button disabled={outOfStock} onClick={()=>add(product)} aria-label={outOfStock?`${product.name} is out of stock`:product.variants.length?`Choose options for ${product.name}`:`Add ${product.name} to cart`}><ShoppingCart/></button></div></article>})}</div>:<div className="catalogue-empty"><Search/><h2>No exact matches found</h2><p>Check the spelling, try a broader term, or browse the complete catalogue.</p><Link href="/shop">Browse all products</Link></div>}
        </section></div>
    </main>
  </div>
}
