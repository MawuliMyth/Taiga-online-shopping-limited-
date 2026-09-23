import { requireCheckoutEnabled } from "../../../../lib/flutterwave";
import { serverClients } from "../../../../lib/server-commerce";
export async function GET() {
  const enabled = process.env.FLUTTERWAVE_CHECKOUT_ENABLED === "true";
  let available = false;
  try {
    requireCheckoutEnabled();
    const { admin } = serverClients();
    const { error } = await admin.from("flutterwave_checkouts").select("reference").limit(0);
    available = !error;
  } catch { /* No secrets or infrastructure diagnostics in the public response. */ }
  return Response.json({ enabled, available }, { headers: { "Cache-Control": "no-store" } });
}
