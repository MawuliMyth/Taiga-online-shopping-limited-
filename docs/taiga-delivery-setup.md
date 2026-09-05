# Taiga-owned delivery calculator

The active `/api/shipping/quote` route now uses Taiga's saved destination rates.
It does not call Shipbubble, need API credentials, or require dimensions for normal
parcels. Origin is Ikeja, Lagos, Nigeria; currency is NGN. Checkout remains manual
bank transfer, with staff responsible for confirming received funds and order totals.

## One-time database setup before publishing

Apply `supabase/migrations/202609060001_taiga_delivery_rates.sql` to the existing
Supabase project using its SQL editor or the project's migration process. It creates
an empty rates table with admin-only RLS and validation constraints; it does not
change customer/order data or seed prices. Until applied, the editor reports setup
required and checkout asks for a manual quote.

## When the client provides rates

Open Admin → Delivery Rates. Add a state-wide rate or city override, enter the base
fee, included kg, additional fee per kg, maximum kg, delivery-day range and extra
destination charge. Enter 0 explicitly when no surcharge applies. Choose whole-kg
rounding or proportional excess-weight pricing. Save incomplete values as disabled
drafts; enable only after approval. A disabled city override excludes that city even
if its state-wide rate is enabled. Missing destinations require manual quotes.

Use Test draft to check values without enabling them. Each product needs its packed
unit weight under Shipping Weight (kg). Set custom specification Bulky item to yes
for products requiring manual delivery quotes. No dummy parcel values are defaults.

## Verification before public activation

Check an admin can save/reload a draft and enable a complete rate, while ordinary
customers cannot read or modify the rates table directly. Test a 4kg cart, city
override, missing weight, disabled destination, maximum weight and quote expiry.
Quotes expire in 15 minutes and clear on local cart/address changes. The WhatsApp
reference is a correlation label, not a persisted or tamper-proof order receipt.
Staff must verify the cart and approved delivery price before confirming payment.

The old disabled Paystack workflow has not been migrated to these rates and must
remain disabled until its server-side payment reconciliation is updated.
