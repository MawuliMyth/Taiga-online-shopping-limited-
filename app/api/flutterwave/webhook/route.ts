import { apiError, CommerceError } from "../../../../lib/server-commerce";
import { readPaymentJson, validReference, verifyFlutterwave, webhookAuthorized } from "../../../../lib/flutterwave";
export async function POST(request:Request){
  try{
    if(!await webhookAuthorized(request.headers.get("verif-hash")))throw new CommerceError("Invalid webhook signature.",401);
    const event=await readPaymentJson(request,65536);
    if(event.event!=="charge.completed"||event.data?.status!=="successful")return Response.json({ok:true,ignored:true});
    if(!validReference(event.data?.tx_ref))return Response.json({ok:true,ignored:true});
    await verifyFlutterwave(event.data.tx_ref,String(event.data.id));
    return Response.json({ok:true});
  }catch(error){return apiError(error)}
}
