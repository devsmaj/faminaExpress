# FA-MINNA Express

Food delivery platform for Abéché, Chad. Static HTML/CSS/JavaScript frontend, Node.js API, Supabase Auth/PostgreSQL/RLS, and Supabase Realtime. Existing orange branding, multipage layout, mobile navigation, authentication video and English/French/Arabic interfaces are retained.

## Development status

Work is isolated on `production/abeche-platform`. No production deployment or push to `main` has been performed. The new database has no restaurant, menu, price, tariff, payment or GPS seed data. Configure a development Supabase project before using real accounts or orders. Airtel Money and Moov Money are disabled until approved integrations pass security tests.

- [Repository audit and phased plan](docs/PRODUCTION_PLAN.md)
- [Create and configure the development Supabase project](docs/SUPABASE_SETUP.md)
- [Release gates and remaining hosted checks](docs/RELEASE_CHECKLIST.md)

## Local setup

Use Node >=22.9. Install dependencies with `npm --prefix backend ci`. Copy `backend/.env.example` to `backend/.env` and fill the development settings; never commit secrets. Apply the initial SQL migration to a new Supabase development project as described in the setup guide.

Run `npm start` for the API (port 3001 by default). Serve the static frontend on port 3000 using a local static server. `assets/js/config.js` uses localhost for local development; the existing deployed API address remains in that file for a future reviewed release.

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
