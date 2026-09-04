import { apiError, authenticatedUser, CommerceError, serverClients } from "../../../../lib/server-commerce";

export async function POST(request:Request){
  try{
    const user=await authenticatedUser(request);
    if(process.env.PAYSTACK_CHECKOUT_ENABLED!=="true") throw new CommerceError("Paystack checkout is temporarily disabled.",503);
    const {delivery_method}=await request.json() as {delivery_method?:string};
    if(!user.email) throw new CommerceError("Your account needs an email address.",400);
    if(delivery_method!=="standard") throw new CommerceError("Only standard delivery is available.",400);
    const {admin}=serverClients();
    const {data:quote,error:quoteError}=await admin.rpc("checkout_quote_for_user",{target_user:user.id,delivery_method});
    if(quoteError||!quote?.amount_minor) throw new CommerceError("Your cart could not be priced. Check availability and try again.",409);
    const secret=process.env.PAYSTACK_SECRET_KEY;
    if(!secret) throw new CommerceError("Paystack checkout is temporarily unavailable.",503);
    const paystack=await fetch("https://api.paystack.co/transaction/initialize",{method:"POST",headers:{Authorization:`Bearer ${secret}`,"Content-Type":"application/json"},body:JSON.stringify({email:user.email,amount:Number(quote.amount_minor),currency:"NGN",metadata:{user_id:user.id,delivery_method}})});
    const payload=await paystack.json() as {status?:boolean;message?:string;data?:{access_code:string;reference:string}};
    if(!paystack.ok||!payload.status||!payload.data) throw new CommerceError(payload.message||"Payment could not be started. Please try again.",502);
    return Response.json({ok:true,access_code:payload.data.access_code,reference:payload.data.reference,quote});
  }catch(error){return apiError(error)}
}
