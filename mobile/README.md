# Nivasa Mobile

Expo shared mobile shell for Android and iOS.

```bash
npm install
npx expo start
```

For an Android bundle smoke test:

```bash
npx expo export --platform android --output-dir dist-preview --no-minify
```

The Android/iOS package identifiers and branded icon/splash assets are configured in `app.json`. Set `EXPO_PUBLIC_API_URL` for a device-accessible API URL; Android emulator development commonly uses `http://10.0.2.2:5000/api/v1`.

For seeded role previews, set `EXPO_PUBLIC_ROLE_PREVIEW` to `seller`, `delivery`, or `admin`. The mobile client selects the matching seeded account and loads that role's protected API summary.
