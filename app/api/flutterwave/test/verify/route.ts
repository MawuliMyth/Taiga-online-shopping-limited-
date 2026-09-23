import { apiError } from "../../../../../lib/server-commerce";
import { testOwner, verifyTest } from "../../../../../lib/flutterwave-test";
export async function POST(request:Request){
  try{const user=await testOwner(request);const body=await request.json();return Response.json(await verifyTest(body.transaction_id,user.id),{headers:{"Cache-Control":"no-store"}})}catch(error){return apiError(error)}
}
