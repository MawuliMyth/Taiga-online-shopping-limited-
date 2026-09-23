import { apiError } from "../../../../../lib/server-commerce";
import { flutterwaveRequest, testOwner, testReference } from "../../../../../lib/flutterwave-test";
export async function POST(request:Request){
  try{
    const user=await testOwner(request);
    const data=await flutterwaveRequest("payments",{
      tx_ref:await testReference(user.id),amount:100,currency:"NGN",
      redirect_url:"https://taigaonlineshoppinglimited.com/admin/flutterwave-test",
      customer:{email:user.email},customizations:{title:"Taiga TEST — no real order"},
      configurations:{session_duration:10,max_retry_attempt:3}
    });
    const link=new URL(data.link);
    if(link.protocol!=="https:"||link.hostname!=="checkout.flutterwave.com")throw new Error("Unexpected payment link.");
    return Response.json({ok:true,url:link.href},{headers:{"Cache-Control":"no-store"}});
  }catch(error){return apiError(error)}
}
