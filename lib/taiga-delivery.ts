export type DeliveryRate = {
  id: string; state: string; city: string; enabled: boolean;
  base_fee: number | null; included_kg: number | null; extra_per_kg: number | null;
  max_kg: number | null; min_days: number | null; max_days: number | null;
  surcharge: number | null; round_up: boolean;
};
const positive = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;
const nonnegative = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0;
export function validRate(rate: DeliveryRate) {
  return nonnegative(rate.base_fee) && positive(rate.included_kg) && nonnegative(rate.extra_per_kg)
    && positive(rate.max_kg) && rate.max_kg >= rate.included_kg
    && nonnegative(rate.min_days) && Number.isInteger(rate.min_days)
    && nonnegative(rate.max_days) && Number.isInteger(rate.max_days) && rate.max_days >= rate.min_days
    && nonnegative(rate.surcharge);
}
export function calculateDelivery(rates: DeliveryRate[], state: string, city: string, weight: number) {
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  // A disabled city override excludes that city from a broader state rate.
  const stateRates = rates.filter(rate => same(rate.state, state));
  const rate = stateRates.find(rate => same(rate.city, city)) ?? stateRates.find(rate => rate.city === "*");
  if (!rate || !rate.enabled || !validRate(rate)) throw new Error("Contact Taiga for a delivery quote to this destination before paying.");
  if (!positive(weight)) throw new Error("Package weight needs to be confirmed by Taiga before payment.");
  if (weight > rate.max_kg!) throw new Error("This package exceeds the automatic weight limit. Contact Taiga for a delivery quote.");
  const extra = Math.max(0, Math.round((weight - rate.included_kg!) * 1000) / 1000);
  const amount = Math.round((rate.base_fee! + (rate.round_up ? Math.ceil(extra) : extra) * rate.extra_per_kg! + rate.surcharge!) * 100) / 100;
  return { amount, weight, minDays: rate.min_days, maxDays: rate.max_days, rateId: rate.id };
}
export function cartPackedWeight(rows: Array<{quantity: number; products: {specifications?: Record<string, unknown>} | null}>) {
  if (!rows.length) throw new Error("Your cart is empty.");
  let grams = 0;
  for (const row of rows) {
    const weight = Number(row.products?.specifications?.["Shipping Weight (kg)"]);
    if (!positive(weight) || weight < 0.001 || !Number.isInteger(row.quantity) || row.quantity < 1 || row.quantity > 99) throw new Error("Some products need their packed weight confirmed. Contact Taiga before paying.");
    if (String(row.products?.specifications?.["Bulky item"] ?? "").toLowerCase() === "yes") throw new Error("Bulky items require a manual delivery quote from Taiga.");
    grams += Math.round(weight * 1000) * row.quantity;
  }
  return grams / 1000;
}
