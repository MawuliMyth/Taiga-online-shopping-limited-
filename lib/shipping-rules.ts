// Pure quote rules shared with tests. Prices and parcel details come from the catalogue.
export function parcelForCart(rows: any[]) {
  if (!rows.length || rows.length > 50) throw new Error("Your cart needs a delivery quote from Taiga.");
  let length = 0, width = 0, height = 0;
  const categories = new Set<number>();
  const package_items = rows.map(row => {
    const product = row.products;
    const variant = product?.variants?.find((item: any) => item.id === row.variant_key);
    if (!product || !product.is_active || (row.variant_key !== "default" && !variant) || variant?.active === false) throw new Error("A cart item is no longer available.");
    const quantity = Number(row.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99 || quantity > Number(variant?.inventory ?? product.inventory)) throw new Error("Check the quantities and availability in your cart.");
    const specs = product.specifications ?? {};
    const weight = Number(specs["Shipping Weight (kg)"]);
    const dims = ["Package Length (cm)", "Package Width (cm)", "Package Height (cm)"].map(key => Number(specs[key]));
    const category = Number(specs["Shipbubble Category ID"]);
    if (![weight, ...dims, category].every(value => Number.isFinite(value) && value > 0) || !Number.isInteger(category)) throw new Error("Some items need their package details confirmed. Contact Taiga for a delivery quote before paying.");
    categories.add(category);
    // Conservative stacked-package estimate using each item's packed dimensions.
    length = Math.max(length, dims[0]); width = Math.max(width, dims[1]); height += dims[2] * quantity;
    const price = Number(variant?.price ?? product.price);
    if (!Number.isFinite(price) || price <= 0) throw new Error("A cart item could not be priced.");
    return { name: product.name, description: product.name, unit_weight: weight, unit_amount: price, quantity };
  });
  if (categories.size !== 1) throw new Error("This mixed parcel needs a delivery quote from Taiga before payment.");
  return { package_items, package_dimension: { length, width, height }, category_id: [...categories][0] };
}

export function referenceRate(couriers: any[]) {
  const rates = couriers.filter(rate => rate.service_type === "pickup" && rate.rate_card_currency === "NGN" && Number.isFinite(Number(rate.rate_card_amount)) && Number(rate.rate_card_amount) > 0);
  if (!rates.length) throw new Error("No delivery reference is available for this address. Contact Taiga before paying.");
  return Math.round(Math.min(...rates.map(rate => Number(rate.rate_card_amount))) * 100) / 100;
}
