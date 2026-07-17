import { apiError, authenticatedUser, serverClients } from "../../../../lib/server-commerce";

export async function POST(request:Request){
  try{
    const user=await authenticatedUser(request);
    const {reference,address}=await request.json() as {reference?:string;address?:Record<string,string>};
    if(!reference||!address) throw new Error("Payment reference and delivery address are required.");
    const secret=process.env.PAYSTACK_SECRET_KEY;
    if(!secret) throw new Error("Paystack is not configured.");
    const response=await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,{headers:{Authorization:`Bearer ${secret}`,"Cache-Control":"no-cache"}});
    const payload=await response.json() as {status?:boolean;message?:string;data?:{status:string;amount:number;currency:string;reference:string;customer?:{email?:string};metadata?:{user_id?:string}}};
    const transaction=payload.data;
    if(!response.ok||!payload.status||transaction?.status!=="success") throw new Error(payload.message||"Payment verification failed.");
    if(transaction.reference!==reference||transaction.currency!=="NGN"||transaction.metadata?.user_id!==user.id||transaction.customer?.email?.toLowerCase()!==user.email?.toLowerCase()) throw new Error("This payment does not belong to the signed-in customer.");
    const {admin}=serverClients();
    const {data:order,error}=await admin.rpc("finalize_paid_checkout",{target_user:user.id,address,payment_ref:reference,paid_amount_minor:transaction.amount,paid_currency:transaction.currency});
    if(error) throw new Error(error.message);
    return Response.json({ok:true,order});
  }catch(error){return apiError(error,error instanceof Error&&error.message.includes("session")?401:400)}
}
