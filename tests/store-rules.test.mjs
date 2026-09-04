import assert from "node:assert/strict";
import test from "node:test";
import {
  NEW_PRODUCT_DAYS,
  availableProductStock,
  isNewProduct,
  nextCartQuantity,
  visibleProductBadge,
} from "../lib/product-rules.ts";
import { allowedOrderStatuses, canTransitionOrder } from "../lib/order-rules.ts";

const DAY = 24 * 60 * 60 * 1000;
const now = Date.parse("2026-09-04T12:00:00Z");

test("new products expire automatically after 30 days", () => {
  assert.equal(NEW_PRODUCT_DAYS, 30);
  assert.equal(isNewProduct(new Date(now - 29 * DAY).toISOString(), now), true);
  assert.equal(isNewProduct(new Date(now - 30 * DAY).toISOString(), now), false);
  assert.equal(isNewProduct(new Date(now + DAY).toISOString(), now), false);
  assert.equal(visibleProductBadge("New", new Date(now - 31 * DAY).toISOString(), now), "");
  assert.equal(visibleProductBadge("Bestseller", new Date(now - 90 * DAY).toISOString(), now), "Bestseller");
});

test("available stock respects active variants", () => {
  assert.equal(availableProductStock({ inventory: 8 }), 8);
  assert.equal(availableProductStock({ inventory: 99, variants: [
    { inventory: 3 },
    { inventory: 4, active: true },
    { inventory: 20, active: false },
  ] }), 7);
});

test("cart quantities cannot exceed inventory or the per-line limit", () => {
  assert.equal(nextCartQuantity(2, 1, 8), 3);
  assert.equal(nextCartQuantity(8, 1, 8), 8);
  assert.equal(nextCartQuantity(98, 5, 120), 99);
  assert.equal(nextCartQuantity(0, 1, 0), 0);
});

test("order statuses move forward through fulfillment", () => {
  assert.equal(canTransitionOrder("pending", "paid"), true);
  assert.equal(canTransitionOrder("processing", "shipped"), true);
  assert.equal(canTransitionOrder("shipped", "pending"), false);
  assert.equal(canTransitionOrder("delivered", "cancelled"), false);
  assert.deepEqual(allowedOrderStatuses("shipped"), ["shipped", "delivered"]);
});
