import { apiError, authenticatedUser, CommerceError, serverClients, validateDeliveryAddress } from "../../../../lib/server-commerce";

export async function POST(request:Request){
  try{
    const user=await authenticatedUser(request);
    if(process.env.PAYSTACK_CHECKOUT_ENABLED!=="true") throw new Error("Paystack checkout is temporarily disabled.");
    const {reference,address}=await request.json() as {reference?:string;address?:Record<string,string>};
    if(!reference||!address) throw new CommerceError("Payment reference and delivery address are required.",400);
    const validatedAddress=validateDeliveryAddress(address);
    const secret=process.env.PAYSTACK_SECRET_KEY;
    if(!secret) throw new CommerceError("Payment verification is temporarily unavailable.",503);
    const response=await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,{headers:{Authorization:`Bearer ${secret}`,"Cache-Control":"no-cache"}});
    const payload=await response.json() as {status?:boolean;message?:string;data?:{status:string;amount:number;currency:string;reference:string;customer?:{email?:string};metadata?:{user_id?:string}}};
    const transaction=payload.data;
    if(!response.ok||!payload.status||transaction?.status!=="success") throw new CommerceError(payload.message||"Payment has not been confirmed.",409);
    if(transaction.reference!==reference||transaction.currency!=="NGN"||transaction.metadata?.user_id!==user.id||transaction.customer?.email?.toLowerCase()!==user.email?.toLowerCase()) throw new CommerceError("This payment does not belong to the signed-in customer.",403);
    const {admin}=serverClients();
    const {data:order,error}=await admin.rpc("finalize_paid_checkout",{target_user:user.id,address:validatedAddress,payment_ref:reference,paid_amount_minor:transaction.amount,paid_currency:transaction.currency});
    if(error) throw new CommerceError("Payment was confirmed, but the order could not be finalized. Contact support with your payment reference.",409);
    return Response.json({ok:true,order});
  }catch(error){return apiError(error)}
}
