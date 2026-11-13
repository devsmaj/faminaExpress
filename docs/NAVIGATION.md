# Navigation and authentication changes

The shared header keeps the existing orange-and-white branding and desktop layout. Public navigation contains Home, Explore Food, Restaurants, About Us, Cart, Language and Login / Sign up. Verified customers see Home, Explore Food, Restaurants, Cart, My Orders, Track Order, My Profile, Language and Sign out. Verified staff see only their own dashboard link alongside public browsing links; staff controls do not appear for customers.

The mobile drawer supports focus trapping/restoration, Escape, an outside-click backdrop, inert closed controls, background scroll locking, current-page links, large touch targets, French/English/Arabic and RTL. The desktop header retains its existing three areas. Language and authentication controls stay inside the mobile drawer.

Guest carts store only item UUIDs and quantities in localStorage. Catalog names/images/prices are refreshed from the API; prices in localStorage are never trusted. The `202611120002_guest_cart.sql` migration and `/api/cart/merge` import a guest draft atomically into the verified customer's cart with an idempotency key. An interrupted response can be retried without duplicate quantities. Conflicting/unavailable items leave the draft saved and expose a retry action in the cart. Server-side one-restaurant and quantity rules still apply. Sign-out does not erase the signed-out customer's persistent server cart or expose it to the next user.

Private page guards wait for verified identity, not editable localStorage role fields. Public visitors get a login prompt with a return URL; wrong roles get an access-denied view. Existing backend/RLS protections remain authoritative. The Track Order link opens an active-order chooser when no order ID is supplied. Restaurant/rider/admin dashboards reuse the existing dedicated pages and their protected APIs.

Run `npm test`, `npm run test:navigation` and the existing `npm run test:browser`. Navigation tests cover real links, guest-cart persistence through Google callback/return navigation, quantity badges, failed sign-out, account isolation, private routes, role-specific dashboards, failed/interrupted imports, keyboard interaction, languages and 320–1440px widths. Browser authentication and API services are isolated fixtures; hosted Supabase/OAuth acceptance remains part of the existing release checklist. No production deployment is included.

## Separate homepages and saved sessions

Visitors use index.html. Verified customers use the role-protected customer-home.html; Home and the header brand link follow that destination, and visiting index.html while signed in redirects to it. Login keeps a saved cart/private-page destination and maps the public homepage to the customer homepage. Both homepages retain their footer. Menu, restaurants, cart, checkout, orders, tracking, profile, login and registration omit the footer and fill the viewport. Informational pages remain unchanged.

Supabase retains and refreshes its session in browser storage. Auth listeners are installed before the initial backend profile check. Temporary network/backend failures no longer clear a verified identity and trigger bounded retries plus reconnect/visibility recovery. A fresh page still requires server verification before exposing private content. Rejected credentials, disabled accounts and explicit sign-out clear the visible identity. Browser storage deletion/private browsing, revoked sessions and missing hosted Supabase/provider settings cannot be overridden by the website.

Validation includes auth-persistence.test.js for fresh-page restoration, temporary failures, initial-outage recovery, invalid identity and explicit sign-out; navigation-smoke.cjs covers separate Home destinations, customer refresh, footer visibility and private-route guards with isolated test accounts.

## Action feedback

Async action buttons use a shared inline spinner, disabled state and aria-busy until their own operation finishes. Original labels/icons remain intact and controls recover on errors. Page links show inline loading during real navigation; immediate menu, language and tab controls do not simulate network work. Sign-out uses an accessible modal with Yes/No, defaults focus to No, supports Escape before confirmation, and disables dismissal while Supabase sign-out is pending. A failed sign-out retains the session and shows an error.

A one-time, short-lived login receipt is written only after server identity verification, carries no token, and displays the five-second success toast on the destination page only for the matching verified user. Failure and ordinary refresh never produce a login success message. Confirmation and success messages support English, French and Arabic. Browser tests cover inline spinners/restoration, login failure/success/refresh, cancel/Escape, sign-out failure and pending confirmation.

## Skeleton page loading

All pages load skeleton CSS in the head and enable first-paint placeholders before page scripts run. Header placeholders remain until the shared header and initial authentication check finish. Main placeholders follow the initial Famina API requests and disappear on either success or error; static informational pages do not wait for account/data requests. There is no minimum skeleton delay and no wait for decorative images or video. Pending images use skeleton backgrounds.

Same-origin page navigation shows placeholders immediately; returning through the browser back/forward cache restores the content. Initial content is inert and aria-busy, skeleton artwork is hidden from screen readers behind one loading status, and reduced-motion preferences disable shimmer. Subsequent mutations retain inline button loading without replacing the entire page. Header requests time out and show a readable error rather than an endless skeleton. Removed forced page fade/slide animation and duplicate homepage directory fetch. Service-worker cache updated to platform-v4.

Browser checks deliberately hold a menu response, verify the skeleton remains, then verify successful and failed responses release it. A separate header failure check verifies the header placeholder is removed and static page content remains accessible. Existing auth, cart, checkout, role and EN/FR/AR layout checks remain applicable.

## Google redirect button loading

Google OAuth requests skipBrowserRedirect and explicitly navigates to the SDK-returned URL after the button can paint. The selected button remains disabled with its inline spinner throughout the browser handoff and final verified-login redirect; failures restore the original button states, and a back/forward-cache return resets the auth panel. Auth requests and shared action handlers no longer start a separate floating spinner. Provider buttons use a high-contrast spinner at their inline end.

The browser regression test holds the Google navigation using the browser navigation event after the SDK resolves, verifies the button is still busy and visible with no floating indicator, rejects a duplicate click, then resumes login and checks the verified success alert. Cache platform-v5 activates after successful precaching and claims clients without forcing a reload; cache cleanup is limited to FA-MINNA cache names.
