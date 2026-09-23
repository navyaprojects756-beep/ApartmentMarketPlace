# Mobile and Play Store Release Checklist

## Local build preparation

- [x] Expo project exists under `mobile/`.
- [x] Android package is `com.gatedcart.marketplace`.
- [x] iOS bundle identifier is `com.gatedcart.marketplace`.
- [x] EAS profiles exist for development, preview, and production.
- [x] Mobile customer Home shell connects to the authenticated Home API with offline preview fallback.
- [x] Mobile customer OTP login, Home filters, Orders history, and role API preview surfaces implemented.
- [x] Android Metro export smoke test passes with Expo SDK-compatible dependencies.
- [~] Connect remaining seller, delivery, and admin mobile screens to authenticated API services; core role queue/status/settings actions are connected and product/report/admin-resource parity remains.
- [ ] Add production API URL through EAS environment variables.
- [x] Add branded source app icon and splash assets to the Expo project.
- [ ] Finalize platform-specific PNG/adaptive icon and notification assets for store submission.
- [ ] Test Android APK/AAB on physical devices.
- [ ] Test iOS archive/TestFlight on a physical device.

## Google Play Console requirements

- [ ] User creates or provides a Google Play Console developer account.
- [ ] Create application with package `com.gatedcart.marketplace`.
- [ ] Configure app signing and upload key.
- [ ] Add store name, descriptions, screenshots, icon, feature graphic, and category.
- [ ] Add privacy policy URL and support contact.
- [ ] Complete Data Safety form.
- [ ] Complete content rating questionnaire.
- [ ] Upload signed production AAB to internal testing.
- [ ] Complete internal/closed testing requirements.
- [ ] Promote the approved build to production.

## iOS App Store requirements

- [ ] Apple Developer account and App Store Connect app record.
- [ ] Provisioning/signing configuration through EAS.
- [ ] App privacy details, screenshots, description, and support URL.
- [ ] TestFlight review and production submission.

## Local APK handoff — 2026-09-23

The preview build target is the Expo `preview` profile. Before installing on a phone, set `EXPO_PUBLIC_WEB_APP_URL` and `EXPO_PUBLIC_API_URL` to the computer's LAN address, start the web app with `npm run dev -- --host 0.0.0.0`, start the API, and ensure Windows Firewall permits the development ports. The generated APK is for local testing only and is not a signed Play Store release.
