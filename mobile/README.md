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

The mobile shell intentionally does not maintain a separate role UI. After website login, the shared web application routes customers, sellers, delivery staff, and Global Admins to the same role workspace used in the browser.

## Physical Android testing

For a preview APK, run from this directory:

```bash
npx eas build --platform android --profile preview
```

The preview profile uses internal distribution and produces an installable Android APK when the EAS build completes. The hosted preview build uses the Render URLs above. A local-network build can instead use the computer's LAN IP; the phone must then be on the same network and the web/API ports must be reachable. This is an internal test build, not a Play Store production artifact.

EAS requires an authenticated Expo account. Run `npx eas login` once before building. The successful hosted build was created with `npx eas build --platform android --profile preview`; the resulting APK was installed and tested on a physical Android device. The local Metro Android export is only a bundle export and is not an installable APK.

The Expo project is owned by the `www.cheritech.com` organization, uses slug `gatedcart-marketplace`, and has Android package `com.gatedcart.marketplace` and iOS bundle identifier `com.gatedcart.marketplace`. The EAS project ID is recorded in `app.json`.

## Shared marketplace update — 2026-09-26

The WebView now includes Global Admin-managed product categories, apartment-scoped category product browsing, application-wide plus apartment-targeted home carousel images, apartment seller visibility settings, and touch/swipe carousel navigation. These features require the deployed API to run the latest Prisma migration before building or testing the mobile shell.
