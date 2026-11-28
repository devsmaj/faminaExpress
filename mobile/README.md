# FAMIPAY Capacitor Android application

The existing Android project and launcher resources are retained under `mobile/android`. The app ID remains `com.famipay.app`; debug APKs use the existing `.preview` suffix so updates replace the distributed preview application rather than installing a second app.

The build copies the website's login, registration, email verification, onboarding, and role-aware private dashboard with their original HTML, CSS, JavaScript, and Supabase client. Onboarding is copied without design edits. Capacitor-native code is limited to email-confirmation deep links, external links, back handling from the shared web navigation, and splash dismissal.

The `famipay://auth/login` confirmation callback must be permitted in Supabase Auth Redirect URLs. The app keeps the website's existing fetch calls and uses Capacitor's native HTTPS transport because the hosted API does not currently allow the WebView's `https://localhost` origin. The app uses the existing API and Supabase settings, not a local/demo financial service.

Build the web bundle with `npm run build --prefix mobile`, run its checks with `npm test --prefix mobile`, and sync Android with `npm run sync --prefix mobile`. An Android SDK and Java 21 are required to assemble the APK.

The original `FAMIPAY-preview-apk.zip` is GitHub artifact `15230979272`, produced by run `46068187252` at commit `ac8486c`. Its project is this same `mobile/android` directory. The installed package is `com.famipay.app.preview`, with the existing preview signing key retained in the `famipay-preview` release. Launcher resources remain unchanged.

The `FAMIPAY Android APK` workflow downloads that original archive, compares package and signing certificate, verifies a higher version code, installs the original followed by `adb install -r` on Android, and launches the updated app. It publishes `FAMIPAY.apk` only after those checks succeed, then removes artifacts named `famipay-android-debug`. Android update screenshots and crash logs are retained separately.

The website's header, homepage and footer download buttons point directly to [FAMIPAY.apk](https://github.com/devsmaj/Famipay/releases/download/famipay-preview/FAMIPAY.apk). Each successful build replaces that release asset, so the same website links always serve the latest published APK. Users can install it over the existing preview app without uninstalling it. Changes to the shared web pages, assets, components or mobile project on `main` automatically build, verify and publish a new version; manual workflow dispatch remains available.

GitHub Actions artifacts are ZIP archives for developer backup, regardless of their display name. The backup artifact is named `FAMIPAY-build-backup`; distribute the release APK URL above, not an Actions artifact or a source-code ZIP.
