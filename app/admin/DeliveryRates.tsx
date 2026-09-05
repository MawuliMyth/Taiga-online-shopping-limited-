"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { calculateDelivery, validRate, type DeliveryRate } from "../../lib/taiga-delivery";
import { nigeriaCities, nigeriaStates } from "../data/nigeriaLocations";

const emptyRate = (): DeliveryRate => ({id:"",state:"",city:"*",enabled:false,base_fee:null,included_kg:null,extra_per_kg:null,max_kg:null,min_days:null,max_days:null,surcharge:null,round_up:true});
const fields = [
  ["base_fee","Base delivery fee (₦)","0.01"], ["included_kg","Weight included (kg)","0.001"],
  ["extra_per_kg","Each extra kg (₦)","0.01"], ["max_kg","Maximum package weight (kg)","0.001"],
  ["min_days","Minimum business days","1"], ["max_days","Maximum business days","1"],
  ["surcharge","Extra destination charge (₦)","0.01"]
] as const;

export default function DeliveryRates(){
  const [rates,setRates]=useState<DeliveryRate[]>([]);
  const [draft,setDraft]=useState<DeliveryRate>(emptyRate);
  const [busy,setBusy]=useState(false),[ready,setReady]=useState(false),[message,setMessage]=useState("");
  const [testWeight,setTestWeight]=useState(""),[testCity,setTestCity]=useState("");
  useEffect(()=>{
    let active=true;
    void supabase.from("delivery_rates").select("*").order("state").order("city").then(({data,error})=>{
      if(!active)return;
      if(error){setMessage("Delivery-rate storage needs its database setup before rates can be saved.");return}
      setRates(data??[]);setReady(true);
    });
    return ()=>{active=false};
  },[]);
  async function save(event:React.FormEvent){
    event.preventDefault();setMessage("");
    if(!nigeriaStates.includes(draft.state))return setMessage("Choose a destination state.");
    if(draft.enabled&&!validRate(draft))return setMessage("Complete all pricing, weight and delivery-time fields before enabling this rate. Enter 0 for no extra charge.");
    setBusy(true);
    const {id,...values}=draft;
    const payload={...values,updated_at:new Date().toISOString()};
    const result=id?await supabase.from("delivery_rates").update(payload).eq("id",id).select().single():await supabase.from("delivery_rates").insert(payload).select().single();
    setBusy(false);
    if(result.error)return setMessage(result.error.code==="23505"?"This destination already has a rate. Edit its existing entry.":"The rate could not be saved. Check your entries and admin session.");
    setRates(current=>[...current.filter(rate=>rate.id!==result.data.id),result.data]);setDraft(result.data);
    setMessage(result.data.enabled?"Delivery rate saved and enabled.":"Draft saved. Customers will need a manual quote for this destination.");
  }
  let preview="Enter a test weight to preview this draft without saving it.";
  if(testWeight){
    try{
      const result=calculateDelivery([{...draft,enabled:true}],draft.state,draft.city==="*"?testCity:draft.city,Number(testWeight));
      preview=`Draft calculation: ₦${result.amount.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} · ${result.minDays}–${result.maxDays} business days. This does not enable the rate.`;
    }catch{preview="Complete the rate fields and use a weight within the limit to preview."}
  }
  return <section className="taiga-delivery-admin panel">
    <header><h2>Delivery rates</h2><p>Origin: Ikeja, Lagos, Nigeria · Currency: NGN</p><p>Set state-wide rates and city overrides. A disabled city override excludes that city from a state-wide rate. Destinations without an enabled rate require a manual quote.</p></header>
    <div className="delivery-admin-layout"><aside><button type="button" onClick={()=>{setDraft(emptyRate());setTestWeight("");setMessage("")}}>Add destination</button>
      {!rates.length&&<p>No rates entered yet. Do not enter example prices for customers.</p>}
      {rates.map(rate=><button type="button" key={rate.id} className={draft.id===rate.id?"selected":""} onClick={()=>{setDraft({...rate});setMessage("");setTestWeight("")}}>{rate.state} · {rate.city==="*"?"All cities":rate.city}<small>{rate.enabled?"Enabled":"Draft / excluded"}</small></button>)}
    </aside><form onSubmit={save}>
      <div className="delivery-fields"><label>Destination state<select value={draft.state} onChange={e=>setDraft({...draft,state:e.target.value,city:"*"})} required><option value="">Choose state</option>{nigeriaStates.map(state=><option key={state}>{state}</option>)}</select></label>
      <label>Destination city<select value={draft.city} onChange={e=>setDraft({...draft,city:e.target.value})} disabled={!draft.state}><option value="*">All cities in this state</option>{(nigeriaCities[draft.state]??[]).map(city=><option key={city}>{city}</option>)}</select></label>
      {fields.map(([key,label,step])=><label key={key}>{label}<input type="number" min={key==="included_kg"||key==="max_kg"?"0.001":"0"} max="999999" step={step} value={draft[key]??""} placeholder="Awaiting client value" onChange={e=>setDraft({...draft,[key]:e.target.value===""?null:Number(e.target.value)})}/></label>)}
      <label>Extra-weight calculation<select value={draft.round_up?"whole":"exact"} onChange={e=>setDraft({...draft,round_up:e.target.value==="whole"})}><option value="whole">Round extra weight up to the next kg</option><option value="exact">Charge proportionally for extra weight</option></select></label></div>
      <label className="delivery-toggle"><input type="checkbox" checked={draft.enabled} onChange={e=>setDraft({...draft,enabled:e.target.checked})}/> Enable this approved rate</label>
      <p>Enter 0 explicitly where no charge applies. Leave unknown values blank and save as a disabled draft. Base fee + extra weight charge + destination charge = delivery fee.</p>
      <button disabled={!ready||busy}>{busy?"Saving…":"Save destination rate"}</button>
      <p role="status">{message}</p>
      <fieldset><legend>Test draft — does not affect checkout</legend><label>Package weight (kg)<input type="number" min="0.001" step="0.001" value={testWeight} onChange={e=>setTestWeight(e.target.value)}/></label>{draft.city==="*"&&<label>Test city<input value={testCity} onChange={e=>setTestCity(e.target.value)} placeholder="Optional city name"/></label>}<p aria-live="polite">{preview}</p></fieldset>
      <p>Product editor: use Shipping Weight (kg) for each packed unit. Mark a custom specification “Bulky item” as “yes” to require a manual delivery quote.</p>
    </form></div>
  </section>;
}
