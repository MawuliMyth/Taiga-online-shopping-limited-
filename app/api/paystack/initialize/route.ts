import { apiError, authenticatedUser, serverClients } from "../../../../lib/server-commerce";

export async function POST(request:Request){
  try{
    const user=await authenticatedUser(request);
    const {delivery_method}=await request.json() as {delivery_method?:string};
    if(!user.email) throw new Error("Your account needs an email address.");
    if(delivery_method!=="standard") throw new Error("Only standard delivery is available.");
    const {admin}=serverClients();
    const {data:quote,error:quoteError}=await admin.rpc("checkout_quote_for_user",{target_user:user.id,delivery_method});
    if(quoteError) throw new Error(quoteError.message);
    const secret=process.env.PAYSTACK_SECRET_KEY;
    if(!secret) throw new Error("Paystack is not configured.");
    const paystack=await fetch("https://api.paystack.co/transaction/initialize",{method:"POST",headers:{Authorization:`Bearer ${secret}`,"Content-Type":"application/json"},body:JSON.stringify({email:user.email,amount:Number(quote.amount_minor),currency:"NGN",metadata:{user_id:user.id,delivery_method}})});
    const payload=await paystack.json() as {status?:boolean;message?:string;data?:{access_code:string;reference:string}};
    if(!paystack.ok||!payload.status||!payload.data) throw new Error(payload.message||"Paystack initialization failed.");
    return Response.json({ok:true,access_code:payload.data.access_code,reference:payload.data.reference,quote});
  }catch(error){return apiError(error,error instanceof Error&&error.message.includes("session")?401:400)}
}
