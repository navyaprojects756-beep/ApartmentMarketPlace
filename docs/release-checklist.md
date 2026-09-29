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
- [x] Verify the final launcher icon and native launch screen through an installed preview APK.
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

The Android preview APK was built through EAS and installed successfully. The final native launch screen uses the centered app icon with a warm background, while the full branded splash appears after the WebView loads the hosted website. It is an internal/testing APK, not a signed Play Store production release. The production AAB, store listing, privacy policy, Data Safety form, and iOS/TestFlight release remain outstanding.

For future builds, authenticate with `npx eas login` from `mobile/` and run `npx eas build --platform android --profile preview`.

## Render deployment checklist

## Current customer commerce verification

- [x] Category and storefront products open the shared product-details view.
- [x] Product images, product-card image areas, rounded corners, and quantity-control placement are consistent across responsive customer screens.
- [x] Empty categories show a designed empty state.
- [x] Multi-seller cart groups items by seller and creates one order per seller.
- [x] Cart rows support product-details navigation and quantity increase/decrease controls.
- [x] Checkout opens the animated order-confirmation page with order tracking.
- [x] Render API startup applies committed Prisma migrations and does not run seed data automatically.

- [x] Render Static Site deployed at `gatedcart.cheritech.com`.
- [x] Render Web Service deployed at `gatedcart-api.onrender.com`.
- [x] Render PostgreSQL database provisioned.
- [x] API configured with the Render internal database URL, JWT secrets, `FRONTEND_URL`, and `PORT=10000`.
- [x] Prisma migrations configured through the API start command.
- [x] Static site configured with `VITE_API_URL`.
- [x] GoDaddy CNAME `gatedcart` configured for the Render static site and HTTPS certificate verified.
- [ ] Add persistent/object storage for uploaded product images before production scale; Render service local storage is not durable across redeploys.

## Push notification release verification — 2026-09-27

- [x] Firebase phone login/session exchange is live.
- [x] Expo Android push token acquisition is verified on a physical device.
- [x] EAS Android FCM V1 credentials are assigned to `com.gatedcart.marketplace`.
- [x] Production WebView URL is configured for preview and production EAS profiles.
- [x] Push-device migration and API are deployed.
- [x] Native, WebView, frontend, and API diagnostics are included in the diagnostic build/deployment.
- [x] Confirm a row appears in `push_devices` after login.
- [ ] Confirm customer and seller order notifications with sound while backgrounded/closed.
- [ ] Confirm notification tap routing opens the relevant order screen.

Trace command:

```powershell
adb logcat -c
adb logcat -v time "ReactNativeJS:I" "*:S"
```

## 2026-09-28 release additions

- [x] Community-service schema migration applied and included in deployment migrations.
- [x] Service and provider image upload flows verified by frontend/backend builds.
- [x] Authenticated `/delete-account` route added; unauthenticated users are sent through OTP login.
- [x] Account deletion requests are persisted and visible to Global Admin.
- [x] Static `/privacy-policy` and `/terms-and-conditions` documents are included in `dist`.
- [ ] Deploy the latest frontend `dist` output and verify both policy URLs on the production domain.
- [ ] Verify `/delete-account` login return flow on the production domain.
- [ ] Implement and verify permanent personal-data purge when a deletion request is completed, with legally required retention exclusions.
- [ ] Add the UDYAM registration number to the public business/legal information after it is provided.
