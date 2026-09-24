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
- [x] Add hosted web/API URLs through the Expo/EAS preview environment variables.
- [x] Add branded source app icon and splash assets to the Expo project.
- [ ] Finalize platform-specific PNG/adaptive icon and notification assets for store submission.
- [x] Build and test the Android preview APK on a physical device.
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

## APK and hosted-service handoff — 2026-09-24

The preview build target is the Expo `preview` profile. The tested hosted configuration is:

- `EXPO_PUBLIC_WEB_APP_URL=https://gatedcart.cheritech.com`
- `EXPO_PUBLIC_API_URL=https://gatedcart-api.onrender.com/api/v1`

The Android preview APK was built through EAS and installed successfully. It is an internal/testing APK, not a signed Play Store production release. The production AAB, store listing, privacy policy, Data Safety form, and iOS/TestFlight release remain outstanding.

For future builds, authenticate with `npx eas login` from `mobile/` and run `npx eas build --platform android --profile preview`.

## Render deployment checklist

- [x] Render Static Site deployed at `gatedcart.cheritech.com`.
- [x] Render Web Service deployed at `gatedcart-api.onrender.com`.
- [x] Render PostgreSQL database provisioned.
- [x] API configured with the Render internal database URL, JWT secrets, `FRONTEND_URL`, and `PORT=10000`.
- [x] Prisma migrations configured through the API start command.
- [x] Static site configured with `VITE_API_URL`.
- [x] GoDaddy CNAME `gatedcart` configured for the Render static site and HTTPS certificate verified.
- [ ] Add persistent/object storage for uploaded product images before production scale; Render service local storage is not durable across redeploys.
