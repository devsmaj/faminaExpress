# Google and phone sign-in

The sign-in pages include a locally hosted cooking video with a pause control,
poster fallback, and reduced-motion/data-saver support. Footage credits are in
`assets/videos/CREDITS.md`. French (Chad) is the default interface language;
the header selector also offers Arabic (Chad), with RTL layout, and English.
Language selection is saved in the browser. Authentication copy, errors, shared
navigation/footer and marked interface labels are translated. Restaurant data
and unmarked long-form page content retain their original language.

Firebase web configuration is in `assets/js/firebase.js`, connected to project
`project-7ad92958-9f96-47a3-8f5`. The web API key is public configuration;
never put service-account private keys in the frontend or repository.

1. In Firebase Authentication, enable Google (with a support email) and Phone.
2. Add the deployed website hostname to Authentication's authorized domains.
3. Configure the allowed SMS regions. Real SMS needs Blaze billing. Start with
   fictional phone numbers and codes in Firebase's Phone provider settings.
4. In `backend`, run `npm install`. Set `JWT_SECRET` to a long random value in
   the server environment, then run `npm start`. This server uses Firebase Admin
   to verify signed ID tokens for this project; no service-account key is needed
   for public-key token verification. Never enable the Auth emulator in production.
5. Configure `assets/js/config.js` with your hosted HTTPS backend API URL if it
   is separate from your website, e.g. `https://api.example.com/api`. The default
   is `/api` on the website origin; local development uses localhost:3001.
6. Serve the frontend over HTTP locally or HTTPS in production. Open register.html
   or login.html. Bare firebase/app imports from the console snippet are replaced
   with pinned browser module imports, so no frontend build step is needed.

Google sign-in and SMS confirmation exchange the Firebase ID token for a signed
FA-MINNA Express customer session, valid for seven days. The server always derives identity
from verified claims and never accepts a client-selected role. Accounts use stable
Firebase UID identifiers. They are not automatically merged with existing demo
email accounts. Logout clears the FA-MINNA Express session; the temporary Firebase session
is signed out after the exchange.

The existing email login and other demo data paths remain. Firebase sessions use
the real API instead of browser demo responses. Existing carts/orders are stored
in server memory and reset on restart; production persistence is separate work.
Existing profile editing is local demo behavior, not an update to Firebase identity.

## Checks

Run `node --test backend/firebase-session.test.js` from the repository root.
For live verification: test Google success/cancellation; an authorized and an
unauthorized domain; a Firebase fictional phone number, incorrect/correct code,
resend, logout, and a protected cart request after login. Confirm a missing or
forged token gets rejected by POST /api/auth/firebase. Real provider/SMS testing
requires the Firebase console settings and a running backend.
