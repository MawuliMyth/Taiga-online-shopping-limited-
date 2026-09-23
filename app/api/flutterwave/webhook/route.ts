import { apiError, CommerceError } from "../../../../lib/server-commerce";
import { testConfig, verifyTest } from "../../../../lib/flutterwave-test";
export async function POST(request:Request){
  try{
    const {hash}=testConfig();
    if(request.headers.get("verif-hash")!==hash)throw new CommerceError("Invalid webhook signature.",401);
    const text=await request.text();
    if(text.length>65536)throw new CommerceError("Webhook too large.",413);
    const event=JSON.parse(text);
    if(event.event!=="charge.completed"||event.data?.status!=="successful")return Response.json({ok:true,ignored:true});
    return Response.json(await verifyTest(event.data.id));
  }catch(error){return apiError(error)}
}
