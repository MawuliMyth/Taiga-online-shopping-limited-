import { authenticatedUser, CommerceError, serverClients, validateDeliveryAddress } from "./server-commerce";

export function liveConfig() {
  const key = process.env.FLUTTERWAVE_SECRET_KEY?.trim();
  const hash = process.env.FLUTTERWAVE_WEBHOOK_HASH?.trim();
  if (!key?.startsWith("FLWSECK-") || key.includes("TEST") || !hash || hash.length < 32)
    throw new CommerceError("Online payments are not available yet. Please contact sales@taigaonlineshoppinglimited.com.", 503);
  return { key, hash };
}

export function requireCheckoutEnabled() {
  liveConfig();
  if (process.env.FLUTTERWAVE_CHECKOUT_ENABLED !== "true")
    throw new CommerceError("Online payments are being configured. Please try again later.", 503);
}

export async function flutterwaveRequest(path: string, body?: unknown) {
  const { key } = liveConfig();
  let response: Response;
  try {
    response = await fetch(`https://api.flutterwave.com/v3/${path}`, {
      method: body ? "POST" : "GET",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000), cache: "no-store",
    });
  } catch {
    throw new CommerceError("The payment service could not be reached. Please retry without making another payment.", 502);
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.status !== "success" || !payload.data)
    throw new CommerceError("Flutterwave could not confirm this request. Please retry shortly or contact support with your payment reference.", 502);
  return payload.data;
}

export async function readPaymentJson(request: Request, limit = 16384) {
  const reader = request.body?.getReader();
  if (!reader) throw new CommerceError("Request body is required.", 400);
  const chunks: Uint8Array[] = []; let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > limit) { await reader.cancel(); throw new CommerceError("Request is too large.", 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new CommerceError("Invalid request.", 400); }
}

export function deliverySnapshot(address: unknown): Record<string, string> {
  const validated = validateDeliveryAddress(address);
  const fields = ["first_name", "last_name", "phone", "additional_phone", "line1", "state", "city", "additional_info"];
  const snapshot: Record<string, string> = {};
  for (const field of fields) {
    const value = validated[field] ?? "";
    if (typeof value !== "string" || value.length > 200) throw new CommerceError("Check your delivery address.", 400);
    snapshot[field] = value;
  }
  return { ...snapshot, delivery_method: "standard", delivery_payment: "courier_separately" };
}

export function validReference(reference: unknown): reference is string {
  return typeof reference === "string" && /^taiga-live-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reference);
}

export function amountMinor(amount: unknown): number {
  // Parse the decimal amount exactly; do not compare floating-point currency values.
  const match = /^(\d{1,12})(?:\.(\d{1,2}))?$/.exec(String(amount));
  if (!match) throw new CommerceError("The payment amount could not be verified.", 409);
  const minor = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  if (!Number.isSafeInteger(minor) || minor <= 0) throw new CommerceError("Invalid payment amount.", 409);
  return minor;
}

export function validateVerifiedPayment(data: any, reference: string, transactionId?: string) {
  if (!data || data.status !== "successful" || data.tx_ref !== reference ||
      !/^\d{1,20}$/.test(String(data.id)) || (transactionId && String(data.id) !== transactionId))
    throw new CommerceError("Payment has not been confirmed. Do not pay again if your account was debited; retry verification or contact support.", 409);
  if (typeof data.currency !== "string" || !data.customer?.email)
    throw new CommerceError("Payment details could not be verified.", 409);
  return { id: String(data.id), amount: amountMinor(data.amount), currency: data.currency, email: String(data.customer.email).toLowerCase() };
}

export async function verifyFlutterwave(reference: string, transactionId?: string) {
  if (!validReference(reference)) throw new CommerceError("Invalid payment reference.", 400);
  if (transactionId && !/^\d{1,20}$/.test(transactionId)) throw new CommerceError("Invalid transaction ID.", 400);
  const data = await flutterwaveRequest(transactionId
    ? `transactions/${transactionId}/verify`
    : `transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`);
  const verified = validateVerifiedPayment(data, reference, transactionId);
  const { admin } = serverClients();
  const { data: result, error } = await admin.rpc("finalize_flutterwave_checkout", {
    payment_ref: reference, provider_transaction: verified.id,
    verified_minor: verified.amount, verified_currency: verified.currency, verified_email: verified.email,
  });
  if (error) throw new CommerceError("Payment verification is pending. Do not pay again. Retry verification or contact support with your payment reference.", 503);
  return { ok: true, ...result };
}

export async function authorizeCheckout(request: Request, reference: string) {
  const user = await authenticatedUser(request);
  const { admin } = serverClients();
  const { data: intent, error } = await admin.from("flutterwave_checkouts").select("user_id").eq("reference", reference).maybeSingle();
  if (error) throw new CommerceError("Payment records are temporarily unavailable.", 503);
  if (!intent) throw new CommerceError("Payment reference was not found.", 404);
  if (intent.user_id === user.id) return;
  // Ask the database's existing MFA-aware policy, using the verified user's bearer token.
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: request.headers.get("authorization")! } }, auth: { persistSession: false },
  });
  const { data: isAdmin, error: roleError } = await client.rpc("is_admin");
  if (roleError || isAdmin !== true) throw new CommerceError("You cannot access this payment.", 403);
}

export async function webhookAuthorized(received: string | null) {
  if (!received) return false;
  const expected = liveConfig().hash;
  // Compare fixed-size digests rather than short-circuiting on secret characters.
  const digest = async (value: string) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  const [a, b] = await Promise.all([digest(received), digest(expected)]);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}
