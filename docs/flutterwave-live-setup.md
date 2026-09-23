# Flutterwave live checkout

## Current activation requirements

1. In the existing Taiga Supabase project, run the entire file
   `supabase/migrations/202609230001_flutterwave_checkout.sql` in SQL Editor.
   It is additive and transactional. Do not rerun it after success.
2. Configure Sites runtime secrets `FLUTTERWAVE_SECRET_KEY` and
   `FLUTTERWAVE_WEBHOOK_HASH`. Do not put secrets in source or public environment variables.
3. Publish this version with `FLUTTERWAVE_CHECKOUT_ENABLED=false` while setup is pending.
4. In Flutterwave **V3 Live webhooks**, set the URL to
   `https://taigaonlineshoppinglimited.com/api/flutterwave/webhook` and the same webhook hash.
   Enable JSON, v3 webhooks, and retries. Save only after this endpoint is deployed.
5. Verify the database migration and webhook configuration, then set
   `FLUTTERWAVE_CHECKOUT_ENABLED=true` and redeploy. Keep Paystack disabled.
6. With the owner's approval, make a small real purchase. This charges real money.
   Verify one order, one stock decrement, the Flutterwave receipt and dashboard payment.
   Resending the same webhook must not create another order.

## Behavior and operations

- Flutterwave Standard hosted checkout; no card details are handled by Taiga.
- Products are priced from the database. Delivery fees are excluded and paid to the courier separately.
- Checkout stores an immutable snapshot of products, variants, quantities, prices, customer email and delivery address.
- Verification re-queries Flutterwave. Redirect query parameters alone never confirm payment.
- Only successful payments matching the expected reference, amount, currency and payer create orders.
- Stock is checked and decremented atomically at fulfilment, not reserved while paying.
- Stock shortages, payment mismatches and additional charges are retained for manual review.
  The admin **Orders → Flutterwave payments** section shows recent attempts and review receipts.
  Review/refund in Flutterwave and contact the customer; refunds are never initiated automatically.
- Admin **Recheck payment** provides reconciliation if the callback/webhook was missed.
  It requires administrator MFA and never charges the customer. No scheduled reconciliation job is configured.
- Manual transfers remain available only while the Flutterwave feature is disabled.
- Resetting/deleting orders preserves payment receipts, preventing replay-created orders.
- This update does not implement automatic refunds, chargeback handling, or courier payments.

## Checks

`node --test tests/flutterwave-live.test.mjs` checks server verification and signatures.

For isolated PostgreSQL tests (no live data is touched):

```
npm install --prefix tmp/flutterwave-sql-check --no-audit --no-fund @electric-sql/pglite
node --test tests/flutterwave-database.test.mjs
```

Never run financial test fixtures against the production database.
