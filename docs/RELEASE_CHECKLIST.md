# Staging and production release gates

This is an acceptance checklist, not a claim that the hosted services have been tested.

## Automated local verification

- `npm test`: migration execution in an isolated PostgreSQL-compatible engine, RLS role/ownership denial, verified catalog, private addresses, validated quantities, server quotes, disabled mobile money, quote theft/change/expiry, idempotency, order state machine, rider access, customer delivery code, cash reconciliation, refunds, API identity/CORS/failure handling, locale reversibility and session preferences.
- `npm run test:browser`: isolated UI fixtures, escaped business content, server-total rendering, single checkout submission and idempotency header, tracking code, owner menu edit, rider/admin controls, mobile/desktop and English/French/Arabic RTL.
- `npm --prefix backend audit --omit=dev`: inspect production dependencies and resolve known issues.
- Fixtures are labeled TEST and exist only inside test code; they are never seeded into development or production projects.

## Mandatory hosted staging checks — pending

- Apply migrations to a fresh Supabase development project and inspect every table/function grant. Verify anonymous, customer A/B, owner A/B, rider A/B, disabled account, and admin permissions through the real REST API and SQL.
- Complete real Google OAuth and phone OTP on mobile and desktop, test refresh/expiry/sign-out across tabs, denied SMS delivery, resend throttling and provider abuse controls. Recheck the configured OAuth redirect allowlist and CAPTCHA/rate limiting before opening public registration.
- Test road routing in actual service zones in Abéché, denied/unavailable GPS, inaccurate readings, map tiles, road-distance/fee calculations, and estimate accuracy. Confirm route-provider handling of addresses as personal data and the actual delivery tariff and commission rules.
- Two-device test: customer checkout → owner accepts/prepares/readies → admin assigns rider → rider confirms pickup → customer sees fresh GPS → rider confirms the customer code → delivered, GPS cleared, cash collected, admin reconciles. Check every order event/notification against the database.
- Use distinct real Supabase sessions to verify Realtime never leaks another customer's order/address/GPS. Test disconnected/reconnecting sockets, token refresh, reassignment, cancellation, stale coordinates, and removal of location visibility after delivery/cancellation. Local subscription stubs do not test Supabase's hosted WebSocket delivery.
- Run actual PostgreSQL concurrency tests with simultaneous duplicate checkout, menu-price edits, reassignment, delivery, cancellation and refund requests. The local test engine executes transactions but is not a multi-connection load test.
- Exercise unavailable items/restaurants, out-of-zone delivery, empty/changed carts, expired quotes, network failure after database commit, duplicate requests, attempts to submit a fake price/payment status, incorrect delivery codes and five-attempt lockout.
- Cash refund: recorded complaint → review → actual funds returned → unique receipt reference stored. Confirm no request/review automatically marks a refund successful.
- Mobile-money providers remain disabled until credential approval, signed/replay-safe webhooks, server-amount reconciliation, refund handling and sandbox security tests are independently reviewed. A disabled adapter is not a tested live payment integration.

## Operational requirements — pending

- Backups and restore drill, Supabase plan/Realtime quotas, routing/tile capacity, monitoring and alerting, secret rotation, domain/HTTPS/CORS configuration, rate limiting at the hosting edge and privacy/retention policies for order addresses and location data.
- Confirm real restaurant partnerships, menu prices/images/availability, owner/rider onboarding and local cancellation/refund policy. Existing marketing/about/contact/legal copy must receive factual business review; placeholder team biographies and contact details from the old template are not verified operational facts.
- Review aggregate/report pagination for production volumes. Current operational views show bounded recent records; admin displays up to 500 and order views up to 200. Add pagination/reporting before those limits become operationally relevant.
- Audit receipt evidence and reconciliation procedures. The software records authorized staff attestations; it cannot verify physical cash transfer by itself.
- After the hosted security and tracking gates pass, review commits and explicitly authorize the production deployment. Do not merge this branch into an automatically deploying branch earlier.
