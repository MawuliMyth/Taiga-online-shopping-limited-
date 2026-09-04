import { createClient, type User } from "@supabase/supabase-js";

export class CommerceError extends Error {
  constructor(message:string,public readonly status:number){super(message);this.name="CommerceError"}
}

export function serverClients() {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!anon||!service) throw new CommerceError("Checkout is temporarily unavailable.",503);
  return {auth:createClient(url,anon,{auth:{persistSession:false}}),admin:createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}})};
}

export async function authenticatedUser(request:Request):Promise<User>{
  const token=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"");
  if(!token) throw new CommerceError("Authentication required.",401);
  const {auth}=serverClients();
  const {data,error}=await auth.auth.getUser(token);
  if(error||!data.user) throw new CommerceError("Your session is invalid or expired.",401);
  return data.user;
}

export function validateDeliveryAddress(address:unknown){
  if(!address||typeof address!=="object")throw new CommerceError("A delivery address is required.",400);
  const value=address as Record<string,unknown>;
  const required=["first_name","last_name","phone","line1","state","city","delivery_method"];
  if(required.some(key=>!String(value[key]??"").trim()))throw new CommerceError("Complete every required delivery field.",400);
  if(value.delivery_method!=="standard")throw new CommerceError("Only standard delivery is available.",400);
  if(!/^(?:\+234|0)(?:7[0-9]|8[0-9]|9[0-1])[0-9]{8}$/.test(String(value.phone).replace(/[\s()-]/g,"")))throw new CommerceError("Enter a valid Nigerian phone number.",400);
  return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,typeof item==="string"?item.trim():item]));
}

export function apiError(error:unknown,status?:number){
  const message=error instanceof Error?error.message:"The request could not be completed.";
  return Response.json({ok:false,message},{status:status??(error instanceof CommerceError?error.status:400)});
}
