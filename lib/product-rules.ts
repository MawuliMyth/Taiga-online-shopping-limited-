export const NEW_PRODUCT_DAYS = 30;
const NEW_PRODUCT_WINDOW_MS = NEW_PRODUCT_DAYS * 24 * 60 * 60 * 1000;

export function isNewProduct(createdAt: string, now = Date.now()) {
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return false;
  const age = now - created;
  return age >= 0 && age < NEW_PRODUCT_WINDOW_MS;
}

export function visibleProductBadge(badge: unknown, createdAt: string, now = Date.now()) {
  const label = String(badge ?? "").trim();
  if (label.toLowerCase() === "new") return isNewProduct(createdAt, now) ? "New" : "";
  return label;
}

export function availableProductStock(product: { inventory?: number; variants?: unknown }) {
  if (Array.isArray(product.variants) && product.variants.length) {
    return product.variants
      .filter((variant: { active?: boolean }) => variant.active !== false)
      .reduce((total: number, variant: { inventory?: number }) => total + Math.max(0, Number(variant.inventory) || 0), 0);
  }
  return Math.max(0, Number(product.inventory) || 0);
}

export function nextCartQuantity(current: number, requested: number, available: number) {
  return Math.max(0, Math.min(99, Math.floor(available), Math.floor(current + requested)));
}
