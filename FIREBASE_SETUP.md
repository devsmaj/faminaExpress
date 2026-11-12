# Authentication setup has moved

This development branch uses Supabase Auth for the existing Google and phone buttons. Firebase custom session tokens are no longer accepted by the production API architecture.

Follow [the Supabase development setup](docs/SUPABASE_SETUP.md) for OAuth, SMS, redirect URLs, environment variables, admin bootstrap and the explicit identity-migration requirements. Do not change the live site until the [release gates](docs/RELEASE_CHECKLIST.md) have passed.
