import { authenticatedUser, CommerceError, serverClients } from "./server-commerce";

// Sandbox connectivity checks only. Never creates orders or changes stock.
export function testConfig(){
  const key=process.env.FLUTTERWAVE_TEST_SECRET_KEY;
  const hash=process.env.FLUTTERWAVE_TEST_WEBHOOK_HASH;
  if(!key?.startsWith("FLWSECK_TEST-")||!hash||hash.length<32)
    throw new CommerceError("Flutterwave test credentials have not been configured.",503);
  return {key,hash};
}
export async function testOwner(request:Request){
  const user=await authenticatedUser(request);
  const {admin}=serverClients();
  const {data,error}=await admin.from("profiles").select("role").eq("id",user.id).maybeSingle();
  const token=request.headers.get("authorization")!.replace(/^Bearer\s+/i,"");
  let aal="";
  try{aal=JSON.parse(atob(token.split(".")[1].replace(/-/g,"+").replace(/_/g,"/"))).aal}catch{}
  if(error||data?.role!=="owner"||aal!=="aal2")throw new CommerceError("Sign in as the owner and complete two-step verification first.",403);
  return user;
}
async function signature(value:string){
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(testConfig().hash),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  return Array.from(new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(value)))).map(n=>n.toString(16).padStart(2,"0")).join("");
}
export async function testReference(userId:string){
  const prefix=`taiga-test_${userId}_${crypto.randomUUID()}`;
  return `${prefix}_${await signature(prefix)}`;
}
export async function flutterwaveRequest(path:string,body?:unknown){
  const {key}=testConfig();
  const response=await fetch(`https://api.flutterwave.com/v3/${path}`,{
    method:body?"POST":"GET",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},
    body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000),cache:"no-store"
  });
  if(!response.ok)throw new CommerceError("Flutterwave test service could not complete the request. Please retry.",502);
  const payload=await response.json();
  if(payload.status!=="success"||!payload.data)throw new CommerceError("Flutterwave test request was not successful.",502);
  return payload.data;
}
export async function verifyTest(transactionId:unknown,userId?:string){
  if(!/^\d{1,20}$/.test(String(transactionId)))throw new CommerceError("A valid transaction ID is required.",400);
  const data=await flutterwaveRequest(`transactions/${transactionId}/verify`);
  const ref=String(data.tx_ref??"");const parts=ref.split("_");
  if(parts.length!==4||parts[0]!=="taiga-test"||parts[3]!==await signature(parts.slice(0,3).join("_"))||
    (userId&&parts[1]!==userId)||data.status!=="successful"||data.currency!=="NGN"||Number(data.amount)!==100||String(data.id)!==String(transactionId))
    throw new CommerceError("This is not a verified Taiga sandbox payment.",409);
  return {ok:true,test:true,message:"Test payment verified. No real order was created and stock is unchanged."};
}
