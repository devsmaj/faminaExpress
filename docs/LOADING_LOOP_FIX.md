# Infinite loading / reload incident

## Reproduced cause

The regression was in frontend initialization, not Supabase account keys or the footer. platform.js explicitly restored the session while onAuthStateChange also started a restore for INITIAL_SESSION and every other auth notification. These independent /auth/me calls each advanced identityRevision. An earlier response could be discarded after a later call started, yet its initial F.ready promise could resolve with F.user still null.

The protected-route guard then detached the page and showed login-required. When the later verification succeeded, navigation.js saw detached routeContent and called location.reload(). Every new document repeated the same overlapping initialization. This explains alternating skeletons, login-required content and the unchanged footer.

The new initial-callback regression test fails against the prior committed source with THREE concurrent verification requests instead of one; it passes against this fix.

Amplifiers: repeated identical SIGNED_IN notifications emitted auth-updated again, refreshing cart/UI; the header polled every 100ms; badge requests joined the global initial-loading counter; timed auth retries and visibility resets could restart state transitions. All 20 HTML documents were audited and contain no duplicate script imports. The duplication was inside initialization/event handling. The service worker had no reload/controllerchange handler; it could preserve old code in cache, so the cache is versioned again.

## Behavior after the fix

- One client, one auth listener, one shared restore and one in-flight verification per token. INITIAL_SESSION during boot is covered by the explicit initial session read. Identical session events are ignored. Late results after sign-out cannot restore identity. Explicit profile updates can still force verification.
- No timed auth retries or visibility-driven auth restarts. A real reconnect or explicit Retry performs one shared recovery attempt. Invalid/rejected tokens settle to login-required instead of being restored by duplicate SDK events. Temporary verification errors remain visible without deleting the saved SDK session.
- No automatic route reloads or automatic redirects from the public homepage. Customer Home/brand links still point to customer-home.html. Guests see the existing login-required gate only on private routes.
- If an already-guarded page becomes authorized, it shows a Continue link for a user-initiated page entry. Old private DOM is never restored for a different account and page controllers are not run twice.
- Public menu/directory API calls are anonymous and independent of SDK restoration. Public content and header can render without authentication. Badge requests run in the background rather than holding the page skeleton.
- SDK session reads have a deadline. Skeleton initialization has a final visible-error deadline; route guards explicitly resolve skeletons. Cancelled/stalled navigation releases its outgoing placeholder.
- Shared bootstrap/cart/login controllers reject duplicate initialization. Realtime callbacks are suppressed after sign-out/account change; subscriptions stop once. Orders/tracking do not initialize private controls after an API request has invalidated the account.
- Existing orange/white styling, page layouts, checkout, role restrictions, Google/phone login and footer placement are preserved. No database, prices or payment logic changed.

## Changed files

- assets/js/platform.js: auth state, serialization/deduplication, bounded session reads, anonymous public API, background requests and subscription cleanup.
- assets/js/navigation.js: stable guards, visible verification error/retry, explicit Continue and removal of reload/automatic public-home redirect.
- assets/js/loading.js: singleton, public readiness, guard resolution and terminal loading/navigation deadlines.
- assets/js/main.js: singleton and removal of header polling/duplicate badge initialization.
- assets/js/cart-state.js and assets/js/cart.js: singleton guards, background badge calls and duplicate event cleanup.
- assets/js/supabase-auth.js: one login controller per panel.
- assets/js/checkout.js and assets/js/delivery-tracking.js: stop initialization if authorization disappears while loading.
- assets/locales/en.json, fr-TD.json, ar-TD.json and catalog.js: localized recovery messages.
- sw.js: platform-v6 cache to replace the affected assets.
- backend/auth-persistence.test.js: eight auth race/persistence/timeout regressions.
- scripts/stability-smoke.cjs: dedicated mobile/desktop no-reload checks.
- scripts/navigation-smoke.cjs: public homepage remains public without an automatic redirect.
- package.json: test:stability command.
- docs/NAVIGATION.md and this report: corrected behavior and diagnosis.

## Verification

- npm test: 40 tests passed, including PostgreSQL/RLS/order lifecycle and eight auth regressions.
- npm run test:stability: 390px and 1440px, logged-in/logged-out, INITIAL_SESSION plus getSession SIGNED_IN callbacks, duplicate events/scripts, failed verification with 65 seconds of simulated time, explicit retry, rejected tokens, private API 401, a stalled auth SDK on a public page, public homepage and stalled configuration reaching a visible error. Document navigation count stays ONE until a user chooses to navigate.
- npm run test:navigation: existing public/customer/staff links, cart/login merge, inline Google handoff, sign-out, private routes, keyboard and EN/FR/AR layouts passed.
- npm run test:browser: checkout and restaurant/rider/admin dashboards, mobile/desktop, EN/FR/AR passed with no browser exceptions.

Browser checks use isolated TEST fixtures, not hosted customer accounts or live payment/GPS providers. This validates the frontend loop fix; it does not claim network availability or a complete hosted production acceptance test.
