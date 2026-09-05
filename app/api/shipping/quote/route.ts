import { authenticatedUser, CommerceError, serverClients, validateDeliveryAddress } from "../../../../lib/server-commerce";
import { calculateDelivery, cartPackedWeight, type DeliveryRate } from "../../../../lib/taiga-delivery";

export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  try {
    const user = await authenticatedUser(request);
    const raw = await request.text();
    if (raw.length > 8192) throw new CommerceError("Request too large.", 413);
    const input = JSON.parse(raw);
    const address = validateDeliveryAddress({ ...input.address, delivery_method: "standard" });
    if (typeof address.state !== "string" || typeof address.city !== "string" || address.state.length > 80 || address.city.length > 80) throw new CommerceError("Check your destination.", 400);
    const { admin } = serverClients();
    const [cart, rates] = await Promise.all([
      admin.from("cart_items").select("quantity,variant_key,products(inventory,is_active,variants,specifications)").eq("user_id", user.id),
      admin.from("delivery_rates").select("*")
    ]);
    if (cart.error || rates.error) throw new CommerceError("Delivery prices are being configured. Contact Taiga for a quote before paying.", 503);
    for (const row of cart.data ?? []) {
      const product = row.products as unknown as {is_active:boolean;inventory:number;variants?:Array<{id:string;active?:boolean;inventory:number}>} | null;
      const variant = product?.variants?.find(item => item.id === row.variant_key);
      if (!product?.is_active || (row.variant_key !== "default" && !variant) || variant?.active === false || row.quantity > Number(variant?.inventory ?? product.inventory)) throw new CommerceError("A cart item is unavailable. Please check your cart.", 409);
    }
    let quote;
    try {
      const weight = cartPackedWeight(cart.data as unknown as Parameters<typeof cartPackedWeight>[0]);
      quote = calculateDelivery(rates.data as DeliveryRate[], address.state, address.city, weight);
    } catch (error) { throw new CommerceError((error as Error).message, 422); }
    return Response.json({ ok: true, ...quote, currency: "NGN", service: "Taiga delivery", reference: `TAIGA-${crypto.randomUUID()}`, expiresAt: Date.now() + 15 * 60000 }, {headers});
  } catch (error) {
    return Response.json({ok:false,message:error instanceof CommerceError ? error.message : "Delivery could not be calculated. Contact Taiga before paying."}, {status:error instanceof CommerceError ? error.status : 503, headers});
  }
}
