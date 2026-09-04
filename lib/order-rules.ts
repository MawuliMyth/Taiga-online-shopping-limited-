export const ORDER_STATUS_TRANSITIONS: Record<string, readonly string[]> = {
  pending: ["paid", "cancelled"],
  paid: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

export function allowedOrderStatuses(current: string) {
  return [current, ...(ORDER_STATUS_TRANSITIONS[current] ?? [])];
}

export function canTransitionOrder(current: string, next: string) {
  return current === next || (ORDER_STATUS_TRANSITIONS[current] ?? []).includes(next);
}
