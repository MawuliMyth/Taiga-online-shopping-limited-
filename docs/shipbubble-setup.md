# Taiga quote-only integration

No shipment booking, label purchase, insurance or tracking calls are implemented.
Shipbubble's permission for ongoing quote-only use is not confirmed. The owner
must check applicable usage restrictions and charges with the provider.

## Activation

Configure server-side hosted secrets (never browser-prefixed variables):

- `SHIPBUBBLE_API_KEY`: replacement key, not the revoked key shared in chat.
- `SHIPBUBBLE_SENDER_ADDRESS_CODE`: validated origin from the Shipbubble account.
  The intended origin is Ikeja, Lagos, Nigeria. Do not fabricate a street address
  or contact information if the provider needs more detail to validate it.
- `SHIPBUBBLE_QUOTES_ENABLED=true`: activate only after testing the account.
- `TAIGA_DELIVERY_AREAS`: owner-approved destinations, in `City,State;City,State`
  format matching checkout choices. Empty means manual confirmation for all areas.

Product specifications in the existing admin editor must contain positive values:
`Shipping Weight (kg)`, `Package Length (cm)`, `Package Width (cm)`,
`Package Height (cm)` and an integer `Shipbubble Category ID` from the provider's
category list. Dimensions are the packed dimensions in centimetres, not the bare
product size. Add the extra entries using the editor's custom specifications.

The quote uses authoritative cart/catalogue data and retail `rate_card_amount`,
not wallet cost. It selects the lowest positive NGN pickup-service reference.
Multiple units use a conservative stacked bounding box, so the UI labels quotes
provisional. Mixed shipping categories and missing parcel data require a manual
quote. No invented weight, dimensions, zero fee or flat-fee fallback is used.

## Verification and limitations

Test a complete parcel, invalid address, unavailable route, missing dimensions,
expired login, expired quote, cart/address changes, API timeout and revoked key.
Compare successful rates with the same route and parcel in Shipbubble's dashboard.
Quotes expire locally after 15 minutes. The in-memory per-user throttle is a
best-effort per-worker safeguard, not a distributed quota; configure platform
rate limits before high-volume operation.

Bank-transfer verification remains manual. Quote references accompany the WhatsApp
receipt message, but messages and browser totals are not trusted payment records.
The administrator must verify catalogue prices, delivery charge and funds before
confirming an order. This does not integrate the disabled Paystack checkout.

Do not enable public checkout until live quotes and the owner's delivery coverage
have been verified. Carrier coverage does not establish the owner's coverage.

References:
- https://docs.shipbubble.com/api-reference/rates/request-shipping-rates
- https://docs.shipbubble.com/api-reference/addresses/validate-address-global
- https://docs.shipbubble.com/get-started/authentication
