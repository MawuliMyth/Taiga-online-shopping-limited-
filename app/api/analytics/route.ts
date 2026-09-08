import { serverClients } from "../../../lib/server-commerce";
import { analyticsEvent } from "../../../lib/analytics-rules";
const recent=new Map<string,{time:number;count:number}>();
export async function POST(request:Request){
  const headers={"Cache-Control":"no-store"};
  const origin=request.headers.get("origin");
  if(origin!==new URL(request.url).origin)return new Response(null,{status:403,headers});
  if(Number(request.headers.get("content-length")||0)>2048)return new Response(null,{status:413,headers});
  try{
    const raw=await request.text();if(raw.length>2048)return new Response(null,{status:413,headers});
    const event=analyticsEvent(JSON.parse(raw));
    const now=Date.now();const key=String(event.visitor_id);const entry=recent.get(key);
    if(entry&&now-entry.time<60000&&entry.count>=30)return new Response(null,{status:429,headers});
    if(recent.size>10000)recent.clear();
    recent.set(key,entry&&now-entry.time<60000?{time:entry.time,count:entry.count+1}:{time:now,count:1});
    const {admin}=serverClients();
    const {error}=await admin.from("site_visit_events").upsert(event,{onConflict:"id",ignoreDuplicates:true});
    if(error)return new Response(null,{status:503,headers});
    return new Response(null,{status:204,headers});
  }catch{return new Response(null,{status:400,headers})}
}
