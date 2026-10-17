# Purchase flow: what is tested, what needs your store accounts

## Flow
Game (Unity IAP) -> store confirms -> game sends `POST /store/purchase {platform, sku, transactionId, receipt}` -> backend asks Google / Apple -> only a CONFIRMED purchase delivers the product contents -> game finishes the store transaction only after the server said granted / already_granted. Server unreachable = transaction stays pending in the store and is re-submitted at the next start (Unity IAP redelivers pending orders).

## Verified here (automated)
- Dev mode (`platform: "editor"`): delivery, idempotency, parallel duplicate requests, other-account reuse of a transaction id (409), unknown sku (404), player cannot create products, refund with "revoke contents" (commerce-smoke.js, 32 checks).
- Fail-closed: no Google/Apple credentials -> real purchases refused; dev mode off -> editor purchases refused; store outage -> 503 (purchase.validator.spec.ts).
- Idempotency key = the STORE's transaction id, not the client's (one receipt under many ids cannot deliver twice), delivery failure after a valid receipt is retryable without double grant (purchase.service.spec.ts).
- Unity IAP Google receipt parsing (purchaseToken extraction).
- Client <-> server: a free pack granted/revoked from the panel unlocks/locks in the game (LiveBackendIntegrationTests, real client, real backend).

## NOT verifiable without your accounts (do before launch)
1. **Google Play**: service account with "Financial data / Manage orders" permission linked in Play Console; license tester account; internal test track build. Buy once, check the panel Ödemeler page shows it verified and the pack unlocks; buy again (must say already owned); cancel a pending purchase.
2. **Apple**: App Store Server API key (.p8, Key ID, Issuer ID), sandbox tester, TestFlight build, `APPLE_ENV=sandbox` first. Buy, restore purchases on a second device.
3. The Google and Apple response parsing was written from the public API documentation and has never run against the real stores.
4. **Refunds/chargebacks initiated by the store are NOT received automatically** (no Google RTDN / Apple Server Notifications endpoint exists). Refunds are processed by an admin in the panel (Ödemeler -> refund, "revoke contents"). Add the notification endpoints if you want automatic revocation.
5. Subscriptions are not supported (non-consumables / consumable bundles only).

## Gap list (complete)
| Area | State | Needs a real store account? |
|---|---|---|
| Google Play receipt check (purchases.products.get, acknowledge) | written from the API docs, never run against Google | YES (service account + license tester) |
| Apple transaction check (App Store Server API, ES256 JWT, bundle/product/transaction match) | written from the docs, never run against Apple | YES (.p8 key, sandbox tester) |
| Apple: `signedTransactionInfo` JWS signature is NOT verified (trust comes from calling Apple's API over TLS with our key) | accepted design, document only | - |
| Google pending purchases (purchaseState 2) | refused as "not valid"; Unity IAP re-submits later, not tested | YES |
| Replay / duplicates | store transaction id is the key; unit-tested with a double (purchase.service.spec) + dev-mode e2e | no |
| Same receipt on another account | 409 (tested) | no |
| Delivery failure after a valid receipt | stays retryable, no double grant (unit-tested) | no |
| Refund / chargeback started by the STORE | **NOT handled**: no Google RTDN (Pub/Sub push) and no Apple App Store Server Notifications V2 endpoint exist. Players keep contents until an admin refunds in the panel | endpoint code: no; verifying it: YES |
| Admin refund with "revoke contents" | tested (dev mode); wallet currency already spent is not clawed back (manual correction) | no |
| Subscriptions, consumable quantities from the store | not supported | - |
| Client: pending order stays unfinished when the server is unreachable | written, not exercised (needs a real store transaction) | YES |
| Client: refused receipt finishes the transaction without delivering | written, not exercised | YES |
| Unity IAP package 5.4.4 API usage (`order.Info.TransactionID/Receipt`) | compiles in the editor; not run on a device | YES |
