# GatedCart Mobile

Expo shared mobile shell for Android and iOS.

```bash
npm install
npx expo start
```

For an Android bundle smoke test:

```bash
npx expo export --platform android --output-dir dist-preview --no-minify
```

The Android/iOS package identifiers and branded icon/splash assets are configured in `app.json`. The app renders the same web application used by the browser through `react-native-webview`, so set `EXPO_PUBLIC_WEB_APP_URL` to the device-accessible web URL and set `EXPO_PUBLIC_API_URL` to the device-accessible API URL. For an Android emulator, use `http://10.0.2.2:5173` and `http://10.0.2.2:5000/api/v1`; for a physical device, use the computer's LAN IP and start Vite with `npm run dev -- --host 0.0.0.0`.

The native Expo launch screen uses the centered `assets/icon.png` with the warm `#fff9ef` background through the `expo-splash-screen` plugin. Android may show this system launch screen briefly before the WebView starts; it cannot be removed completely. The hosted website splash uses the full `splash.png` artwork copied to the root `public/splash.png`; changing that asset requires a new website deployment, while changing the native icon/splash configuration requires a new APK build.

The exact icon and native launch screen can only be verified by installing an EAS preview APK. Expo Go previews the web application but does not reproduce the final installed app icon or native Android launch screen.

For hosted builds, use:

```env
EXPO_PUBLIC_WEB_APP_URL=https://gatedcart.cheritech.com
EXPO_PUBLIC_API_URL=https://gatedcart-api.onrender.com/api/v1
```

These values guarantee that browser, Android, and iOS use the same login, routes, navigation, and marketplace workflows.

The mobile shell intentionally does not maintain a separate role UI. After Firebase phone login in the shared WebView, the application routes customers, sellers, delivery staff, and Global Admins to the same role workspace used in the browser.

## Physical Android testing

For a preview APK, run from this directory:

```bash
npx eas build --platform android --profile preview
```

The preview profile uses internal distribution and produces an installable Android APK when the EAS build completes. The hosted preview build uses the Render URLs above. A local-network build can instead use the computer's LAN IP; the phone must then be on the same network and the web/API ports must be reachable. This is an internal test build, not a Play Store production artifact.

EAS requires an authenticated Expo account. Run `npx eas login` once before building. The successful hosted build was created with `npx eas build --platform android --profile preview`; the resulting APK was installed and tested on a physical Android device. The local Metro Android export is only a bundle export and is not an installable APK.

The Expo project is owned by the `www.cheritech.com` organization, uses slug `gatedcart-marketplace`, and has Android package `com.cheritech.gatedcart` and iOS bundle identifier `com.cheritech.gatedcart`. The EAS project ID is recorded in `app.json`.

## Shared marketplace update — 2026-09-26

The WebView now includes Global Admin-managed product categories, apartment-scoped category product browsing, application-wide plus apartment-targeted home carousel images, apartment seller visibility settings, and touch/swipe carousel navigation. These features require the deployed API to run the latest Prisma migration before building or testing the mobile shell.
The shared WebView customer flow also includes multi-seller carts with one order created per seller, cart quantity controls, product-details navigation from category and cart views, consistent `Go to cart` actions, and the animated order-confirmation page with order tracking. The mobile shell does not maintain a separate implementation of these screens; it loads the hosted web application.

## Push notification diagnostics — 2026-09-27

The native shell requests permission, creates the Android `orders` channel with default sound, acquires the Expo token using the EAS project ID, and injects it into the hosted WebView. The WebView registers it against the authenticated API session.

Expected log order is `Expo push token acquired`, `WebView load finished`, `webview-probe`, `push-debug`, and `push-registration`, followed by API logs for request receipt, authentication, and database registration. Vivo/CleverTap/Facebook system push logs are unrelated to GatedCart.

## Current hosted routes and package — 2026-09-28

- Android package: `com.cheritech.gatedcart`.
- iOS bundle identifier: `com.cheritech.gatedcart`.
- Privacy policy: `https://gatedcart.cheritech.com/privacy-policy`.
- Terms: `https://gatedcart.cheritech.com/terms-and-conditions`.
- Account deletion: `https://gatedcart.cheritech.com/delete-account`.

The account-deletion URL is not a public deletion form. It requires the customer to log in with OTP and then creates a deletion request in the API database. After changing the Android package, Firebase must contain an app registered as `com.cheritech.gatedcart`, and a newly downloaded `google-services.json` must be used for native builds.

## Order handover verification — 2026-10-04

The shared WebView now displays one six-digit OrderPin for the entire order in customer order tracking. Sellers and assigned delivery staff use the same web UI to verify that single PIN at pickup or delivery; the API completes the order when it matches. The deployed API must apply migration `20261004150000_order_verification_code` before testing this flow.


## Order fulfillment history update - 2026-10-04

The shared WebView now uses the same order-history rules on Android, iOS, and browser:

- Takeaway orders show the seller pickup address and seller phone.
- Delivery orders show the customer delivery address and customer phone.
- New orders use immutable checkout-time fulfillment snapshots, so later profile/address changes do not rewrite the order history.
- Cancel order opens an in-app confirmation modal; no browser confirmation is used for that customer action.
- The order status timeline has separated top spacing for compact mobile readability.

The hosted API must apply migration `20261004170000_order_fulfillment_snapshots` before testing new orders on the mobile WebView.

## Current order references and seller filters - 2026-10-13

New orders shown in the shared WebView use a compact globally unique reference such as `GC-261013-X7K4M2`. Existing references remain unchanged. The customer and seller order cards show date/time, and the seller Orders view supports Today, Yesterday, custom From/To, and status filters. The UI displays `PREPARING` as `Processing` while the API status remains unchanged.

## Current mobile behavior and non-production build — 2026-10-13

- Pulling down from the top refreshes the WebView and preserves the current page, including Orders.
- The customer search result list overlays the home content below the search box and does not extend the page layout.
- Platform maintenance mode is controlled by Global Admin through the hosted web application. Non-admin users see the configured maintenance message.
- Push tokens are registered after login and are re-registered when Expo/FCM rotates a token. The Android package and Firebase client are both `com.cheritech.gatedcart`.
- Build an installable non-production APK with:

```bash
npx eas build --platform android --profile preview
```

Install the fresh preview APK, allow notifications, log in, and verify that the API logs show `[push] device registered` before testing a notification campaign.

## Mobile browser theme update - 2026-10-14

- The shared web entry document uses GatedCart orange (`#ff6b00`) as the mobile browser theme color. This affects Android mobile Chrome when the hosted app is opened in a browser and does not require a new native APK build.

## Live release authentication - 2026-10-14

- The shared WebView uses Firebase phone authentication only; dummy OTP login is no longer available.
- The native APK does not need rebuilding for the web authentication change when it already loads the hosted web URL. Rebuild only when native code, package configuration, or notification configuration changes.
- Verify Firebase phone login in the hosted WebView after deployment before distributing the APK.

## Shared WebView release behavior - 2026-10-18

- Seller order status changes use a clickable lifecycle bar. Delivered requires the customer OrderPin; seller cancellation requires confirmation.
- Customer ratings use a manual one-at-a-time carousel with left/right arrows. The same web implementation is loaded by Android, iOS, and browser clients.
- Browser notification behavior is controlled by the hosted web app and Firebase Web Push. Native notification behavior remains controlled by Expo and the installed mobile build.
- A native rebuild is not required for web-only lifecycle, coupon, rating, or browser notification UI changes when the APK already loads the hosted web URL. Deploy the web/API and run hosted smoke tests before release.

## Shared ratings, availability, and notifications - 2026-10-18

- The shared WebView includes optional 1–5 seller/product ratings after completed or delivered orders. Ratings below 2 require a comment, and community service providers can also receive ratings. Comments and reviewer identity are not shown publicly.
- Seller and product rating aggregates are displayed only when the seller enables `Display customer ratings publicly` in Seller Settings. Provider aggregates are shown only when reviews exist.
- Seller availability uses the configured active flag, weekday, operating hours, and `APP_TIME_ZONE` (default `Asia/Kolkata`) consistently in Home, category browsing, storefronts, and the seller workspace.
- Browser notification prompts are part of the shared web app, not a separate native screen. The browser prompt is shown in-app only for signed-in users with active orders, at most once per day. Native push permission and Expo token registration continue to use the native shell flow.
