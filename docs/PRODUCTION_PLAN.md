# Repository audit and implementation plan

Audit date: 2026-11-12. Baseline: ea6eb0d. Work branch: production/abeche-platform.

## Scope and existing design

Reviewed the file inventory, all backend routes and session utilities, frontend data/API shim and page controllers, HTML forms and component structure, CSS/media rules, service worker, locale generation and existing tests. Existing orange FA-MINNA branding, static multipage structure, header, authentication background, cards, notifications and language controls will be retained. The reference image informs checkout behavior only; it is not a redesign request. Asset photographs are illustrative, not proof of a partnership.

## Findings

- Backend persistence: users, carts, orders, menus, restaurant-owner data and push subscriptions use independent in-memory arrays. Restart loses business records. Owner orders do not share customer orders.
- Frontend shim: frontend-api.js intercepts API calls, stores plaintext demo passwords, issues fabricated sessions, invents drivers/GPS/ETAs and returns simulated payment responses. Guests can see invented restaurants and USD prices. This must be removed from the production path.
- Checkout: client calculates USD delivery/tax and submits its own total; no authoritative item verification, stock/availability check, transaction, address persistence, idempotency or cancellation/refund lifecycle. Stripe handlers and placeholders do not meet the requested payment scope.
- Access control: no RLS or Supabase schema. Payment status can be edited without authentication. Owner tokens default to restaurant 1. Push broadcast is public. Arbitrary status transitions and insufficient validation permit privilege and order manipulation.
- Identity: Google/phone Firebase token verification exists; other account paths are demo-only. Profile edits are local only. Production will use Supabase Auth Google/phone while keeping the same UI; existing Firebase identities require explicit account migration rather than silently assuming their identity.
- Tracking: Google Maps placeholder key, New York center, fake positions, polling; no rider role/dashboard, actual GPS upload, server routing, delivery proof or Supabase Realtime.
- Frontend: shared base config exists but several controllers hardcode localhost; shim masks this. Backend-controlled strings are interpolated into HTML. Currency formatting is USD. No credible approved local catalog exists in the repository.
- Operations: root package points at a nonexistent root server; no database migrations, reproducible lockfile, release gate, security checklist or staging acceptance evidence. Existing 17 tests pass but some explicitly assert demo behavior, not production correctness.
- Localization and presentation: existing English/French/Arabic catalog, RTL, responsive header, toast notifications and background media can be reused. New strings need all three locales. User-entered business content must remain unaltered.

## Implementation phases and acceptance gates

1. Audit/plan (this commit): document gaps, preserve baseline, use isolated branch, no deployment.
2. Database/security: Supabase Auth-backed profiles, role ownership, approved restaurants/verified menu, addresses, carts, zones, orders/items/events, payments/refunds, notification records and rider locations. RLS on every table; restricted transaction RPCs for checkout and lifecycle. Empty business catalog by default. Test SQL and ownership denial with an isolated local database.
3. Commerce API: validated Supabase bearer identity and user-scoped database requests, explicit CORS, request limits, error handling, server quotes, atomic/idempotent checkout, cancellation and refund requests, disabled mobile money providers. No client can write paid/refunded state.
4. Existing customer UI: remove shim/fabricated data; use approved catalog and integer XAF prices, persistent cart/addresses/history, one checkout handler and quote expiry, real order confirmation only after database commit. Preserve page classes/layout.
5. Operations: adapt existing restaurant dashboard and add admin/rider pages using shared styles. Admin approvals, assignments, zones and commissions; owners manage only their restaurant; rider confirms pickup/delivery and shares real GPS only after permission.
6. Routing/tracking: real routing provider server-side; no straight-line road-distance claims or synthetic fallback. Interactive map and RLS-filtered Supabase Realtime; explicit stale/disconnected/unconfigured states, revoke location access after completion. Delivery fee comes from admin-configured zones, not invented tariffs.
7. Verification/release: SQL transaction/security tests, critical API/order flows, frontend smoke tests at mobile/desktop and three locales. Record limitations; keep live payments off. Do not push to auto-deploying main or deploy production. Hosted Supabase Auth/SMS/OAuth/Realtime and provider sandbox acceptance require configured staging services.

## Decisions and external setup

- XAF integer amounts only. No invented restaurant, price, delivery tariff, commission, tax or payment result. No business seed data; tests use clearly named fixtures in isolated databases.
- Supabase PostgreSQL is the business source of truth. Browser uses publishable/anon key only. Node forwards verified user bearer tokens to PostgREST so RLS also applies through the API. Atomic lifecycle functions own financial mutations.
- Airtel Money and Moov Money adapter contracts are disabled until approved Chad merchant credentials, webhook signature specifications and sandbox tests exist. Cash on delivery records amount due, not payment success; collection requires delivery evidence and admin reconciliation.
- Routing requires an explicitly configured OSRM-compatible service with coverage verified in Abéché. No paid provider is provisioned automatically.
- Needed for staging: Supabase development project URL/public key, migration execution, Google OAuth and Chad-capable SMS provider, verified restaurant/menu/location/image records, real delivery zones/tariffs and commission policy, routing endpoint, approved riders. Do not put privileged keys in chat or frontend files.

## Baseline validation

`npm.cmd test --prefix backend`: 17/17 passed before changes. No Supabase project configured or PostgreSQL/Docker CLI detected. Hosted end-to-end checks are not yet possible. Local checks are not evidence that live payments or live GPS work.
