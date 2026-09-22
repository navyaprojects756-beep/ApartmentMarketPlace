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

For production builds, `EXPO_PUBLIC_WEB_APP_URL` must point to the hosted web application. This guarantees that browser, Android, and iOS use the same login, routes, navigation, and marketplace workflows.

The mobile shell intentionally does not maintain a separate role UI. After website login, the shared web application routes customers, sellers, delivery staff, and Global Admins to the same role workspace used in the browser.
