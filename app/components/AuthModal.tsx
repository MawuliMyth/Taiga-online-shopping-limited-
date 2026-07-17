"use client";

import { useState } from "react";
import { LogIn, X, Mail, Lock, User as UserIcon } from "lucide-react";
import { supabase } from "../../lib/supabase";

export function AuthModal({ onClose, reason, showGoogle=true }: { onClose: () => void; reason?: string; showGoogle?:boolean }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function socialSignIn(){
    setBusy(true);
    setMessage("");
    const redirectTo=`${window.location.origin}${window.location.pathname}`;
    const {error}=await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo}});
    if(error){setBusy(false);setMessage(error.message.includes("provider is not enabled")?"Google sign-in has not been enabled in Supabase yet.":error.message)}
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault(); 
    const cleanEmail=email.trim().toLowerCase(),cleanName=name.trim();
    if(mode==="signup"&&!/^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ' -]{1,49}$/.test(cleanName))return setMessage("Enter a valid full name using letters, spaces, apostrophes or hyphens.");
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail))return setMessage("Enter a valid email address.");
    if(password.length<8)return setMessage("Your password must contain at least 8 characters.");
    setBusy(true); 
    setMessage("");
    const result = mode === "signin"
      ? await supabase.auth.signInWithPassword({ email:cleanEmail, password })
      : await supabase.auth.signUp({ email:cleanEmail, password, options: { data: { full_name: cleanName } } });
    setBusy(false);
    if (result.error) return setMessage(result.error.message.toLowerCase().includes("fetch")?"We could not reach the secure account service. Check your connection and try again.":result.error.message);
    if (mode === "signup" && !result.data.session) return setMessage("Check your email to confirm your account.");
    onClose();
  }

  return <div className="auth-overlay" role="dialog" aria-modal="true" aria-label="Customer account" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <div className="auth-modal animate-scale-up" style={{ position: "relative" }}>
      <button className="auth-close" onClick={onClose} aria-label="Close"><X size={18}/></button>
      
      {reason && mode === "signin" && (
        <div className="auth-required" style={{ display: "flex", gap: "12px", alignItems: "center", background: "var(--primary-light)", border: "1px solid var(--primary)", padding: "12px", borderRadius: "var(--radius-md)", marginBottom: "16px", color: "var(--primary)" }}>
          <LogIn size={18} />
          <div>
            <strong style={{ fontSize: "12px", display: "block" }}>Authentication Required</strong>
            <span style={{ fontSize: "11px", color: "var(--muted)" }}>{reason}</span>
          </div>
        </div>
      )}

      <span className="kicker">Taiga Market Account</span>
      <h2 style={{ fontSize: "24px", fontWeight: 800, margin: "8px 0 4px" }}>{mode === "signin" ? "Welcome back" : "Create your account"}</h2>
      <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "24px" }}>{mode === "signin" ? "Sign in securely to manage your cart, orders, and wishlist." : "Register to save favorites, track orders, and checkout faster."}</p>
      
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {showGoogle&&<><div className="social-auth-grid single"><button type="button" onClick={socialSignIn} disabled={busy} className="social-auth-button"><img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt=""/>Continue with Google</button></div><div className="auth-divider"><span>or continue with email</span></div></>}
        {mode === "signup" && (
          <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700 }}>
            Full name
            <div style={{ position: "relative" }}>
              <UserIcon size={16} style={{ position: "absolute", left: "12px", top: "14px", color: "var(--muted-light)" }} />
              <input 
                type="text"
                value={name} 
                onChange={e=>setName(e.target.value)} 
                minLength={2}
                maxLength={50}
                pattern="[A-Za-zÀ-ÿ' -]{2,50}"
                title="Enter a valid full name using letters, spaces, apostrophes or hyphens."
                autoComplete="name"
                required 
                style={{ width: "100%", height: "44px", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", paddingLeft: "38px", paddingRight: "14px", fontSize: "13px", background: "var(--card-bg)" }}
                placeholder="Joseph Mensah"
              />
            </div>
          </label>
        )}
        
        <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700 }}>
          Email address
          <div style={{ position: "relative" }}>
            <Mail size={16} style={{ position: "absolute", left: "12px", top: "14px", color: "var(--muted-light)" }} />
            <input 
              type="email" 
              value={email} 
              onChange={e=>setEmail(e.target.value)} 
              maxLength={254}
              autoComplete="email"
              required 
              style={{ width: "100%", height: "44px", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", paddingLeft: "38px", paddingRight: "14px", fontSize: "13px", background: "var(--card-bg)" }}
              placeholder="you@example.com"
            />
          </div>
        </label>
        
        <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 700 }}>
          Password
          <div style={{ position: "relative" }}>
            <Lock size={16} style={{ position: "absolute", left: "12px", top: "14px", color: "var(--muted-light)" }} />
            <input 
              type="password" 
              minLength={8}
              maxLength={72}
              autoComplete={mode==="signin"?"current-password":"new-password"}
              value={password} 
              onChange={e=>setPassword(e.target.value)} 
              required 
              style={{ width: "100%", height: "44px", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", paddingLeft: "38px", paddingRight: "14px", fontSize: "13px", background: "var(--card-bg)" }}
              placeholder="••••••••"
            />
          </div>
        </label>
        
        {message && (
          <div className="auth-message" style={{ background: "var(--secondary)", color: "var(--primary)", padding: "10px", borderRadius: "var(--radius-sm)", fontSize: "12px", textAlign: "center", fontWeight: "600" }}>
            {message}
          </div>
        )}
        
        <button 
          className="auth-submit" 
          disabled={busy} 
          style={{ height: "44px", background: "var(--primary)", color: "#ffffff", borderRadius: "var(--radius-md)", fontWeight: "750", fontSize: "14px", transition: "background-color 0.2s" }}
        >
          {busy ? "Please wait…" : mode === "signin" ? "Sign In" : "Create Account"}
        </button>
      </form>
      
      <button 
        className="auth-switch" 
        onClick={()=>setMode(mode === "signin" ? "signup" : "signin")} 
        style={{ width: "100%", textAlign: "center", fontSize: "12px", fontWeight: "700", color: "var(--primary)", marginTop: "20px", background: "none", border: "none", cursor: "pointer" }}
      >
        {mode === "signin" ? "New here? Create an account" : "Already registered? Sign in"}
      </button>
    </div>
  </div>;
}
