# Create the development database

The original project did not have a persistent database. It used JavaScript arrays in Node and demo records in browser localStorage. This branch replaces those paths with Supabase PostgreSQL and Supabase Auth. The current production site is unchanged until a reviewed deployment.

1. Open https://supabase.com/dashboard and create an account/organization.
2. Choose **New project**, name it **FA-MINNA Express Development**, choose a region appropriate for testing connectivity from Abéché, and save a strong database password privately. A plan must be selected in your own account; no paid resources are created by this repository.
3. Wait for provisioning. Copy the **Project URL** and **publishable/anon API key** from the project's connection/API settings. The URL and public key identify the project; they are not database passwords.
4. In a **new, dedicated development project**, open **SQL Editor** and execute `supabase/migrations/202611120001_platform.sql`, followed by `supabase/migrations/202611120002_guest_cart.sql`, once each in that order. They create the schema, functions, RLS policies, Realtime publication entries and retry-safe guest-cart import. They deliberately insert no restaurants, menus, tariffs or orders. If the initial migration is already applied, run only the new guest-cart migration. Do not run the initial migration against an unrelated existing project.
5. In **Authentication → Providers**, enable Google with your approved Google OAuth client credentials. Configure its callback URL using the value Supabase displays. Enable Phone with a supported SMS provider and credentials that can actually deliver to Chad. No SMS service is simulated or automatically activated.
6. In **Authentication → URL Configuration**, set the development frontend URL and allow the exact `login.html` callback URLs you will test, for example `http://localhost:3000/login.html`. Keep this branch on a separate staging origin. Do not point production users at an untested project.
7. Copy `backend/.env.example` to `backend/.env`. Fill `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and the server-only `SUPABASE_SERVICE_ROLE_KEY` (or server secret API key). Keep privileged keys out of the frontend, Git and chat. `FRONTEND_ORIGINS` is a comma-separated list of exact allowed browser origins, without paths.
8. Set `ROUTING_BASE_URL` to your approved OSRM-compatible routing endpoint. Verify actual road coverage and routes in Abéché before accepting orders. Without routing configuration, a quote fails honestly; straight-line distance is never presented as road distance. Map tiles use OpenStreetMap with attribution, normal browser caching and no bulk/offline tile download. A production tile provider and usage/capacity review are release requirements.
9. Install with `npm --prefix backend ci`, run `npm test`, then start the API with `npm start` from the repository root. Node >=22.9 is required. The backend reads `backend/.env` when started through the provided npm script.
10. Serve the static frontend on port 3000 using your local static server. Its existing config chooses `http://localhost:3001/api` on localhost. `/health` reports whether database settings are present; it does not pretend to have tested the remote database. Open the website and sign in with a real Google/phone account.
11. Bootstrap the first admin manually in the Supabase SQL Editor after verifying your own user UUID under Authentication → Users:

    ```sql
    update public.profiles set role = 'admin' where id = 'YOUR-VERIFIED-USER-UUID';
    ```

    Sign out and back in, then open `admin-dashboard.html`. Public sign-up always creates a customer. Metadata cannot choose an admin/owner/rider role.

12. The admin promotes verified restaurant owners and riders, creates real restaurant records with confirmed coordinates and image rights, approves menus, and configures real delivery-zone bounds, fees and commission policy. Owners submit/update menus; content and price edits remove verification until the admin reviews them. No record means the directory shows an empty state.
13. Under Supabase's replication/publication controls, verify that `orders`, `order_events`, `rider_locations` and `notifications` are included in `supabase_realtime`. The migration adds them when that publication exists. RLS SELECT policies govern which subscriber can receive each row. Browser channel filters are convenience filters, not authorization.

## Authentication migration

The existing Google/phone buttons and pages are retained, but this branch uses Supabase Auth instead of Firebase. Firebase-issued application JWTs and fabricated `frontend-token-*` sessions cannot access the new API. Existing Firebase users must reauthenticate through the configured Supabase providers. Do not merge or silently link accounts using an unverified client-supplied email. There is no durable production customer database in the previous source to migrate automatically. Inventory real deployed data before rollout.

Supabase maintains refreshed sessions in browser storage. Preference cookies contain language/theme only. Shared devices should sign out; sensitive API responses are `no-store`, and the service worker does not cache business requests. A future same-site BFF with HttpOnly sessions can further reduce the exposure of bearer sessions to script injection.

## Mobile money and refunds

Airtel Money and Moov Money are disabled adapters. Setting an environment flag does not activate them. Do not add a fake provider, arbitrary client `paid` endpoint or unsigned webhook. Each integration needs approved Chad merchant credentials, documented amount/currency/merchant matching, signature and replay verification, durable event IDs, idempotent reconciliation, and sandbox refund tests before activation.

Cash starts as `due`, becomes `collected` only when the assigned rider provides the customer's six-digit delivery code, and becomes `paid` only after an admin confirms the cash was received and counted. A refund request/review does not return money. An admin can record a **completed cash refund** only with a unique receipt reference after returning funds; the reference, actor and time are stored. This does not invoke a payment provider or prove a physical cash transfer automatically.

## No production deployment yet

Work is isolated on `production/abeche-platform`; no changes are pushed to auto-deploying `main`. Follow `docs/RELEASE_CHECKLIST.md` before deciding whether to publish. Project creation, credentials, verified business data and hosted acceptance checks remain necessary.

Official references: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [database functions](https://supabase.com/docs/guides/database/functions), [phone authentication](https://supabase.com/docs/guides/auth/phone-login), [Realtime Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes), [OSRM API](https://project-osrm.org/docs/v5.24.0/api/), [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/).
