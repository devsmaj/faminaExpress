# Development implementation status

Date: 2026-11-12. Branch: `production/abeche-platform`. Production was not deployed or updated.

## Implemented locally

| Area | Development implementation |
| --- | --- |
| Cart/checkout | Persistent per-customer cart; item/quantity validation; one restaurant per order; unavailable items remain removable; server-routed, expiring XAF quotes; atomic checkout, immutable item snapshots and idempotency. |
| Directory/menu | Empty-by-default database catalog, admin restaurant approval, menu verification, image URLs, availability and integer XAF pricing. Editing price/content requires reverification. |
| Customer | Existing Google/phone interface connected to Supabase Auth, refreshable sessions, private saved delivery addresses, profile name updates, order history, cancellation and refund requests. |
| Restaurant | Existing dashboard layout, assigned restaurant selector, real menu editing/availability, order acceptance/preparation/ready states and charts derived from recent records. |
| Rider | Role-protected assignments, explicit browser GPS permission/sharing/stop, pickup confirmation, customer delivery-code verification, cash-collection confirmation and delivery completion. |
| Map/tracking | Leaflet map centered on Abéché for orientation, real user-selected coordinates, server OSRM road routing, quoted distance/fees/estimate, Supabase Realtime subscriptions and explicit disconnected/stale GPS states. No fabricated driver position or live ETA. |
| Payments/refunds | Disabled Airtel/Moov adapter contracts; COD due/collected/reconciled ledger; no client payment-status writes; refund review separate from money return; completed cash refunds require an admin-recorded unique receipt. |
| Database/security | Supabase Auth identities, RLS on all business tables, restricted SQL transaction functions, protected Node endpoints, exact CORS allowlist, body/rate limits, parameterized REST/RPC payloads, escaped HTML and admin audit records. |
| Admin | Customer/owner/rider roles and account access, restaurant approvals/commissions, menu verification, order/rider assignment, delivery zones/tariffs, cash reconciliation, refund review/receipts and code-lockout reset. |
| Notifications | Transactional order-event and notification rows, RLS-filtered Realtime subscriptions and existing top-of-page toasts. Legacy public broadcast endpoint removed. Background push/SMS delivery is not claimed. |
| UI/localization | Existing branding/pages/styles retained, added operations pages share those styles, local EN/FR/AR messages and RTL, mobile menu, spinners and photo loading behavior retained. |

## Verification performed

- 31 automated tests passed: isolated PostgreSQL-compatible migration/RLS/checkout/lifecycle/payment-security checks, API/auth/routing boundaries, unavailable-cart removal, localization and session behavior.
- Browser fixture checks passed for customer checkout → tracking, restaurant menu editing, rider assignments, admin controls, HTML injection escaping, mobile/desktop and EN/FR/AR with no browser exceptions.
- Production dependency installation audit reported zero known vulnerabilities after compatible patches and an explicit patched `qs` override.
- All referenced HTML assets and service-worker precache entries were checked for existence. Supabase/Leaflet/Chart.js browser bundles are pinned and include licenses. Committed `node_modules` artifacts and unused legacy auth/payment/demo code were removed from Git tracking; `npm ci` installs dependencies from the lockfile.

## Not yet verified or activated

No Supabase project existed in the user's account during implementation. No project was provisioned, no migrations were applied to a hosted database, and no real Google OAuth/SMS, hosted Realtime multi-user delivery, route-provider coverage, GPS journey, physical cash handoff or mobile-money payment was tested. Browser services in automated tests use isolated fixtures; SQL tests use an embedded PostgreSQL-compatible engine rather than a hosted multi-connection Supabase stack.

Create/configure the development project using `SUPABASE_SETUP.md`, then complete every hosted gate in `RELEASE_CHECKLIST.md`. Approval of merchant credentials alone is insufficient to enable mobile money: provider-specific signed/replay-safe reconciliation and refund code plus sandbox tests must be implemented and reviewed first. Operational views currently show bounded recent records, so pagination/aggregate reporting remains a production-volume follow-up. Existing template marketing/legal/contact facts also require business review.
