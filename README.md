# FAMIPAY

FAMIPAY is a digital payments and everyday services platform for Chad, evolving from the former FA-MINNA Express food delivery application. It brings wallet and transfer interfaces, mobile money, airtime, bill payments, QR payments, shopping and delivery services into a unified mobile-first experience.

The platform uses a static HTML/CSS/JavaScript frontend, Node.js API, Supabase Auth/PostgreSQL/RLS and Supabase Realtime, with English, French and Arabic interfaces.

- [FAMIPAY web application](https://devsmaj.github.io/Famipay/)
- [Existing Render backend](https://faminaexpress.onrender.com)

The legacy backend service name is retained for compatibility. Payment interfaces do not imply that external providers or security endpoints are production-ready.

## Development status

FAMIPAY frontend development continues on `main`. The historical `production/abeche-platform` plan documents the earlier delivery platform. Use a separate development Supabase project and test accounts for validation. Payment PIN changes, recovery, biometric authorization and external payment integrations require verified backend support and end-to-end testing before real-money use. Airtel Money and Moov Money must remain disabled until approved integrations pass security tests.

- [Repository audit and phased plan](docs/PRODUCTION_PLAN.md)
- [Create and configure the development Supabase project](docs/SUPABASE_SETUP.md)
- [Release gates and remaining hosted checks](docs/RELEASE_CHECKLIST.md)

## Local setup

Use Node >=22.9. Install dependencies with `npm --prefix backend ci`. Copy `backend/.env.example` to `backend/.env` and fill the development settings; never commit secrets. Apply the initial SQL migration to a new Supabase development project as described in the setup guide.

Run `npm start` for the API (port 3001 by default). Serve the static frontend on port 3000 using a local static server. `assets/js/config.js` uses localhost for local development; review the configured deployed API address before release.

## Validation

- `npm test`: isolated database/RLS/order/payment-security tests, API tests, localization and session tests.
- `npm run test:browser`: isolated TEST fixtures for customer checkout/tracking, restaurant/rider/admin pages, mobile/desktop and EN/FR/AR. Requires Chrome; use `BROWSER_CHANNEL=chromium` after installing Playwright Chromium if needed.
- `npm --prefix backend audit --omit=dev`: production dependency audit.
- `npm run build:locales`: rebuild the locale bundle after JSON edits.
- `npm run build:vendor`: copy pinned browser libraries and licenses after a reviewed dependency update.

Browser fixture tests do not verify hosted Google/SMS login or Supabase WebSocket delivery. Hosted staging acceptance and actual PostgreSQL concurrency tests remain release gates. Cash receipt/refund records are authorized staff attestations, not automated proof of physical funds transfer.

## Main source locations

- `backend/platform/`: protected API, Supabase gateway, routing and disabled payment adapters.
- `supabase/migrations/`: schema, RLS, transactional quotes/checkout, lifecycle, GPS visibility, audit and refund rules.
- `assets/js/`: existing page controllers connected to verified database records.
- `restaurant-owner-dashboard.html`, `rider-dashboard.html`, `admin-dashboard.html`: role-protected operations interfaces.
- `assets/vendor/`: pinned Supabase, Leaflet and Chart.js browser bundles with licenses.

Business data comes only from approved records. The former browser demo API, fake tracking and in-memory financial routes have been removed. The historical Firebase setup is superseded by the Supabase setup guide; existing users must reauthenticate during a reviewed migration.


## Centralized payment integration (planned)

All services use one authenticated payment engine: quote → initiate → authorize → reserve funds atomically → execute → reconcile → receipt. Internal wallet transfers settle in the ledger; external payments use approved provider adapters. Pending or uncertain provider results must be reconciled before releasing reserved funds.

| Proposed endpoint | Purpose |
| --- | --- |
| POST /api/payments/quote | Server-calculated fees and expiring quote |
| POST /api/payments/initiate | Idempotent transaction creation |
| POST /api/payments/authorize | Six-digit PIN or transaction-bound WebAuthn proof |
| POST /api/payments/execute | Authorized execution |
| GET /api/payments/:id | Owner-scoped transaction status |
| POST /api/webhooks/:provider | Signed provider confirmation |
| GET /api/transactions | Owner-scoped history |

Target integrations: FAMIPAY wallet, mobile money, bank transfers, cards, QR, bills, airtime/data and merchant payments.

Security requirements: preserve existing PIN hashes and pepper; rate-limit verification; require fresh identity proof for recovery; store only biometric public-key credentials, never fingerprints; bind authorization to amount, currency and recipient; enforce single-use authorization, idempotency, atomic double-entry accounting, signed webhooks and reconciliation. Never expose service-role credentials to the browser.

Release gates: verify the Render-linked backend source, inspect the live Supabase schema, implement and test migrations in development, test concurrent spending and replay prevention, verify provider sandbox settlement and refunds, and obtain production approval. Real-money activation remains disabled until these gates pass. The endpoints above are proposed contracts, not a claim of deployed functionality.
