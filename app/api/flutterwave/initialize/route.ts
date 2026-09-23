import { apiError, authenticatedUser, CommerceError, serverClients } from "../../../../lib/server-commerce";
import { deliverySnapshot, flutterwaveRequest, readPaymentJson, requireCheckoutEnabled } from "../../../../lib/flutterwave";

export async function POST(request: Request) {
  try {
    const user = await authenticatedUser(request);
    requireCheckoutEnabled();
    const body = await readPaymentJson(request);
    if (!user.email || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.request_id ?? "") ||
        !Number.isSafeInteger(body.expected_minor) || body.expected_minor <= 0)
      throw new CommerceError("Return to your cart and try again.", 400);
    const address = deliverySnapshot(body.address);
    const { admin } = serverClients();
    const { data: intent, error } = await admin.rpc("create_flutterwave_checkout", {
      target_user: user.id, checkout_request: body.request_id, delivery_address: address, expected_minor: body.expected_minor,
    });
    if (error || !intent) {
      // Only intentional SQL validation errors may be shown; hide database/schema errors.
      throw new CommerceError(error?.code === "P0001" ? error.message : "Checkout is not ready yet. Please contact support.", 409);
    }
    if (intent.status !== "pending") throw new CommerceError("This checkout has already been processed. Check your orders before paying again.", 409);
    if (Date.parse(intent.expires_at) <= Date.now()) throw new CommerceError("This payment link has expired. Return to your cart to start again.", 409);
    if (intent.checkout_url) return Response.json({ ok: true, url: intent.checkout_url, reference: intent.reference }, { headers: { "Cache-Control": "no-store" } });
    if (!intent.created) throw new CommerceError("This payment attempt is still being prepared. Return to your cart and retry shortly.", 409);
    const origin = new URL(request.url).origin;
    const allowed = ["https://taigaonlineshoppinglimited.com", "https://www.taigaonlineshoppinglimited.com", "https://taiga-online-shopping.josephmawulemensah04.chatgpt.site"];
    const returnOrigin = allowed.includes(origin) ? origin : allowed[0];
    const payment = await flutterwaveRequest("payments", {
      tx_ref: intent.reference, amount: (intent.amount_minor / 100).toFixed(2), currency: "NGN",
      redirect_url: `${returnOrigin}/payment/return`,
      customer: { email: intent.customer_email, name: `${address.first_name} ${address.last_name}`, phonenumber: address.phone },
      customizations: { title: "Taiga Online Shopping Limited", description: "Products only. Courier delivery is paid separately." },
      configurations: { session_duration: 30, max_retry_attempt: 3 },
    });
    const url = new URL(payment.link);
    if (url.protocol !== "https:" || url.hostname !== "checkout.flutterwave.com" || url.username || url.password)
      throw new CommerceError("The payment link could not be validated.", 502);
    const { error: saveError } = await admin.from("flutterwave_checkouts").update({ checkout_url: url.href }).eq("reference", intent.reference).eq("status", "pending");
    if (saveError) throw new CommerceError("The payment link could not be saved. Please return to your cart and try again.", 503);
    return Response.json({ ok: true, url: url.href, reference: intent.reference }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
