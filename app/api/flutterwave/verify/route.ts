import { apiError, CommerceError } from "../../../../lib/server-commerce";
import { authorizeCheckout, readPaymentJson, validReference, verifyFlutterwave } from "../../../../lib/flutterwave";

export async function POST(request: Request) {
  try {
    const body = await readPaymentJson(request);
    if (!validReference(body.reference)) throw new CommerceError("Invalid payment reference.", 400);
    await authorizeCheckout(request, body.reference);
    return Response.json(await verifyFlutterwave(body.reference, body.transaction_id ? String(body.transaction_id) : undefined), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
