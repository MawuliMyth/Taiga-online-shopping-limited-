"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../../../lib/supabase";
import { AuthModal } from "../../components/AuthModal";
import { StorePanels } from "../../components/StorePanels";
const allowed=["cart","wishlist","orders","account","inbox"] as const;
export default function AccountSection({params}:{params:Promise<{section:string}>}){const {section}=use(params),router=useRouter();const kind=allowed.includes(section as any)?section as typeof allowed[number]:"account";const [user,setUser]=useState<User|null>(null),[ready,setReady]=useState(false);
useEffect(()=>{supabase.auth.getSession().then(({data})=>{setUser(data.session?.user??null);setReady(true)});const {data}=supabase.auth.onAuthStateChange((_e,s)=>{setUser(s?.user??null);setReady(true)});return()=>data.subscription.unsubscribe()},[]);
return <div className="account-route"><div className="account-route-backdrop"><Link href="/" className="logo"><span>T</span>Taiga<small>MARKET</small></Link><p>Secure customer area</p></div>{ready&&!user&&<AuthModal reason={`Please sign in to access your ${kind}.`} onClose={()=>router.push("/")}/>} {user&&<StorePanels kind={kind} user={user} onClose={()=>router.push("/")} onChanged={()=>{}}/>}</div>}
