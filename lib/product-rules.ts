export const NEW_PRODUCT_DAYS = 30;
export function selectProductOption(variants: { options?: Record<string,string>; inventory?: number; active?: boolean }[], current: Record<string,string>, name: string, value: string) {
  const candidates = variants.filter(v => v.active !== false && Number(v.inventory) > 0 && v.options?.[name] === value);
  if (!candidates.length) return current;
  const next: Record<string,string> = { [name]: value };
  for (const [key, selected] of Object.entries(current)) {
    if (key !== name && candidates.some(v => v.options?.[key] === selected && Object.entries(next).every(([k,val]) => v.options?.[k] === val))) next[key] = selected;
  }
  return next;
}

export function visibleSpecifications(specifications: Record<string,unknown> = {}) {
  return Object.entries(specifications).filter(([,value]) => value != null && !["", "not applicable", "n/a", "na"].includes(String(value).trim().toLowerCase()));
}
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
