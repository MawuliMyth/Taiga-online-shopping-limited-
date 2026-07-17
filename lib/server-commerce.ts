import { createClient, type User } from "@supabase/supabase-js";

export function serverClients() {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!anon||!service) throw new Error("Server commerce is not configured.");
  return {auth:createClient(url,anon,{auth:{persistSession:false}}),admin:createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}})};
}

export async function authenticatedUser(request:Request):Promise<User>{
  const token=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"");
  if(!token) throw new Error("Authentication required.");
  const {auth}=serverClients();
  const {data,error}=await auth.auth.getUser(token);
  if(error||!data.user) throw new Error("Your session is invalid or expired.");
  return data.user;
}

export function apiError(error:unknown,status=400){
  const message=error instanceof Error?error.message:"The request could not be completed.";
  return Response.json({ok:false,message},{status});
}
