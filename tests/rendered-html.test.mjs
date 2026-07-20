import assert from "node:assert/strict";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${path}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, { waitUntil() {}, passThroughOnException() {} });
}

test("server-renders the Taiga storefront", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Taiga Online Shopping Limited/);
  assert.match(html, /Search products, brands and categories/);
  assert.match(html, /Shop by category/);
  assert.match(html, /Today(?:&apos;|&#x27;|')s deals/);
  assert.match(html, /Delivery information/);
  assert.match(html, /Returns &amp; refunds/);
  assert.match(html, /Privacy policy/);
  assert.match(html, /Terms &amp; conditions/);
  assert.match(html, /Visa · Mastercard · Verve · Bank transfer/);
});

test("server-renders the protected admin entry", async () => {
  const response = await render("/admin");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Taiga/);
  assert.match(html, /Verifying access/);
  assert.match(html, /Return to storefront/);
});
