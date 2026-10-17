# GatedCart Marketplace

Apartment/community marketplace platform with responsive web, PostgreSQL persistence, REST APIs, and an Expo Android/iOS client shell.

## Requirements

- Node.js 20+
- PostgreSQL running locally on port 5432
- A local `.env` containing `DATABASE_URL` (copy `.env.example` and adjust credentials)

## Install and database setup

```bash
npm install
npx prisma migrate deploy --schema prisma/schema.prisma
npm run db:seed
```

If PostgreSQL is not installed locally, the optional Compose database can be started with:

```bash
docker compose up -d postgres
cp .env.example .env
```

Stop it with `docker compose down`; add `-v` only when you intentionally want to remove the local database volume.

The seed creates four apartments, all user roles, six named sellers (including apartment and outside sellers), 50+ products, inventory, delivery assignments, advertisements, and sample orders.

Production authentication uses Firebase phone OTP. The local seeded accounts and dummy OTP documentation are retained only as historical test-data notes and are not available through the production API.

Seed accounts:

```text
Global Admin:       9000000001 / OTP 00001
Global Admin:       9000000002 / OTP 00002
Customer:           9000000010 / OTP 00010
Apartment Seller:   9000000020 / OTP 00020
Outside Seller:     9000000030 / OTP 00030
Apartment Seller:   9000000050 / OTP 00050 (Sweet Home Bakery)
Apartment Seller:   9000000060 / OTP 00060 (Fashion Corner)
Outside Seller:     9000000070 / OTP 00070 (Sri Lakshmi Supermarket)
Outside Seller:     9000000080 / OTP 00080 (Fresh Vegetables)
Delivery Boy:       9000000040 / OTP 00040
```

The seed currently includes two Global Admin users, one customer, six seller-owner accounts, and one delivery-boy account. Seller owners can also have the customer role for testing. The delivery account is linked to all seeded sellers and the ABC Residency delivery area.

## Run web and API

Terminal 1:

```bash
npm run api:dev
```

API: `http://localhost:5000`

Terminal 2:

```bash
npm run dev
```

Web: `http://localhost:5173`

Role previews:

- Customer: `http://localhost:5173/`
- Seller: `http://localhost:5173/?role=seller`
- Delivery: `http://localhost:5173/?role=delivery`
- Global Admin: `http://localhost:5173/?role=admin`

OpenAPI JSON: `http://localhost:5000/api-docs/openapi.json`

## Mobile shell

```bash
cd mobile
npm install
npx expo start
```

Android and iOS package identifiers are configured in `mobile/app.json`.

## Validation commands

```bash
npm run build
npm run api:build
npm test
npm run db:status
```

## Project documentation

- Functional requirements: `apartment_marketplace_full_project_prompt.md`
- Technical architecture: `docs/technical-architecture.md`
- Development checkpoint: `docs/development-progress.md`
- API reference: `docs/api.md`

## Current implementation checkpoint — 2026-09-24

- The active web customer, seller, delivery, and admin workspaces share the same authenticated application and backend API.
- The customer splash screen uses the built-in responsive HTML/CSS artwork; the previously tested external SVG splash asset is not part of the active app.
- OTP entry displays dash placeholders until the user enters the code. Local development OTP validation still uses the last five phone digits.
- The database should remain empty for fresh manual testing unless `npm run db:seed` is intentionally run. Seed data is test-only and is not required for the schema or application structure.
- The mobile wrapper uses the device-accessible web URL and API URL. A preview APK is the recommended artifact for physical-device testing; production signing and Play Store release remain separate steps.

## Hosted deployment checkpoint — 2026-09-24

- The web application is hosted as a Render Static Site at `https://gatedcart.cheritech.com`.
- The backend is hosted as a Render Web Service at `https://gatedcart-api.onrender.com`; API routes use the `/api/v1` prefix.
- The Render PostgreSQL database is the production persistence target. The API uses Render's internal database URL; local pgAdmin uses the database's external URL with PostgreSQL SSL mode `require`.
- The static site build uses `npm ci && npm run build`, publishes `dist`, and receives `VITE_API_URL=https://gatedcart-api.onrender.com/api/v1` through Render environment variables.
- The API service uses `npx prisma migrate deploy --schema prisma/schema.prisma && npm run api:start` as its start command and receives `FRONTEND_URL=https://gatedcart.cheritech.com` and `PORT=10000` through Render environment variables. `api:start` regenerates Prisma Client from the checked-in schema before launching the server, preventing stale-client errors. No seed command is part of deployment.
- The Expo/EAS preview environment uses `EXPO_PUBLIC_WEB_APP_URL=https://gatedcart.cheritech.com` and `EXPO_PUBLIC_API_URL=https://gatedcart-api.onrender.com/api/v1`. The Android preview APK was built successfully and tested against the hosted services.
- The final native launch configuration uses the centered `mobile/assets/icon.png` on a warm `#fff9ef` background; the full `mobile/assets/splash.png` artwork is used by the hosted website splash after the WebView starts.

## Latest marketplace features — 2026-09-26

- Global Admin now manages shared product categories, including category images and active/inactive status.
- Seller product creation uses active global categories; seller-owned category management is removed from the active seller navigation. Products may use `Other` when no shared category applies.
- Customer Home displays global category chips with images. Selecting a category opens products from all approved/open sellers serving the customer's apartment.
- Home carousel promotions support application-wide images and apartment-targeted images. Customers receive both global images and images targeted to their primary apartment.
- Apartment settings contain seller visibility (`Community`, `Outside`, or `Both`) and apartment-specific carousel uploads.
- Carousel images use a consistent responsive display frame with automatic rotation and pointer/touch swiping. Recommended carousel assets are `1200 × 500 px` (12:5); product images are recommended at `1000 × 1000 px`.

## Seller and catalog updates - 2026-10-17

- Approved sellers open the customer marketplace first after login. Seller workspace access remains available from the customer seller entry point; seller accounts are not forced directly into the seller workspace.
- Seller availability checks use `Asia/Kolkata` for both the current weekday and time. A seller is shown only when `is_open` is true and the current India time falls within its configured operating hours.
- Outside seller applications require seller name, business name, description, and business address. The submit button remains disabled until all four fields contain text.
- Product description, instructions, SKU, unit, category, and inventory fields are optional where supported. Empty product details and instructions do not block product creation.

## Customer commerce and UI update - 2026-09-26

- Category browsing opens the shared product-details view for every product, with corrected image framing, rounded corners, fixed product-card image areas, and stable quantity controls.
- Empty categories use a designed empty state instead of a blank page.
- Storefront, category, and product-detail pages expose the orange-themed `Go to cart` action consistently; the cart header icon is hidden on the cart screen.
- Customers can add products from multiple sellers in one cart. Items are grouped by seller and checkout creates one order per seller.
- Cart items link back to product details and support increasing/decreasing quantity directly from the cart.
- Seller fulfillment labels show delivery only for delivery-enabled sellers; pickup-only sellers are shown as takeaway.
- After checkout, customers see an animated order-confirmation page with order numbers, tracking, and expanded order details.

## Database deployment note

Render applies committed Prisma schema migrations during API startup through `prisma migrate deploy`. Existing business records are preserved. The deployment does not automatically run `prisma/seed.ts`; seed/demo records require an intentional `npm run db:seed` execution.

When the Prisma schema changes, run before starting the API:

```bash
npx prisma generate --schema prisma/schema.prisma
npx prisma migrate deploy --schema prisma/schema.prisma
```

## Current release status — 2026-09-28

- Global Admin manages community-service categories with images, apartment availability, and service providers with contact details and images.
- Customers see apartment-scoped community services on Home. Available services are shown first; services without providers are visually disabled. Selecting a service opens a separate provider list.
- Account deletion requests are stored in `account_deletion_requests`. Customers use the authenticated URL `https://gatedcart.cheritech.com/delete-account`; Global Admin reviews requests from the Deletion Requests workspace.
- Public policy pages are available at `https://gatedcart.cheritech.com/privacy-policy` and `https://gatedcart.cheritech.com/terms-and-conditions`. Static copies are generated under `dist/privacy-policy/` and `dist/terms-and-conditions/` for hosts that do not provide SPA fallback routing.
- The mobile identifiers are `com.cheritech.gatedcart` for Android and iOS. Firebase must use the same Android package identifier; download a newly registered `google-services.json` after changing the Firebase app package.
- The current public policy uses Cheritech as the operator. Add the UDYAM number when it is available.

Account deletion currently records and reviews the request. Automatic permanent deletion of personal data on `COMPLETED` still requires a separate purge implementation, subject to retention obligations.

## Latest order tracking update — 2026-10-04

- Checkout creates one unique six-digit verification code for the entire order.
- Customers see one OrderPin and a fulfillment-aware progress timeline, including packing, pickup/delivery, address/phone context, payment, and pending-order cancellation.
- Sellers and assigned delivery staff verify the single OrderPin at final handover through `POST /api/v1/orders/:orderId/verify-items`.
- The API validates authorization and the order PIN, marks the order verified, changes it to `COMPLETED`, writes status history, and notifies the customer.
- Apply `20261004150000_order_verification_code` before using the flow. Render applies committed migrations at API startup; seed data remains manual.


## Current order fulfillment and history update - 2026-10-04

- Customer cancellation uses an in-app confirmation modal; the customer order flow does not use a browser confirmation for cancellation.
- The order progress card has added spacing above the status timeline.
- Takeaway orders preserve and display the seller pickup address and seller phone number.
- Delivery orders preserve and display the customer delivery address and customer phone number.
- New orders store immutable fulfillment snapshots in `orders.fulfillment_address` and `orders.fulfillment_phone`. Updating a customer profile/address or seller settings does not change those new historical order details.
- The snapshot migration is `20261004170000_order_fulfillment_snapshots` and must be applied in every environment.

Run after pulling the change:

```bash
npx prisma generate --schema prisma/schema.prisma
npx prisma migrate deploy --schema prisma/schema.prisma
npm run api:build
npm run build
```

Orders created before this migration may still use their existing relational address data because no historical snapshot existed at the time they were placed.

## Current order references and seller workflow - 2026-10-13

- New orders use a customer-friendly reference such as `GC-261013-X7K4M2`. The date and random code do not expose the total order count.
- The existing unique `orders.order_number` constraint guarantees that two orders cannot share the same displayed reference. Existing orders retain their original references.
- Seller Orders supports Today, Yesterday, Custom From/To, and status filters, with order date/time shown on seller and customer order cards.
- Delivery seller actions are Accept, Processing, Out for delivery, and Delivered. Takeaway seller actions are Accept, Processing, Ready, and Handed over.

## Current platform controls and mobile UX — 2026-10-13

- Global Admin Settings includes platform maintenance mode with an on/off switch and a custom message. When enabled, customers and sellers see a maintenance screen; Global Admin access remains available.
- Maintenance mode is stored in `PlatformSetting` under `maintenance_mode` and is read publicly through `GET /api/v1/maintenance`.
- Customer search results appear as an overlay below the search box without moving the home banner, categories, or community services. Empty searches display `No items found.`
- Mobile pull-to-refresh preserves the current page, including Orders, instead of returning to Home after reload.
- Outside sellers provide a required business address during registration and can update it from Seller Settings. Community sellers do not use an outside-business address field; their apartment context is used in seller/order details.
- Native push registration now re-registers tokens when Expo/FCM rotates them. Android and iOS use package identifier `com.cheritech.gatedcart`.
- Browser push notifications use Firebase Cloud Messaging Web. Set `VITE_FIREBASE_VAPID_KEY` from Firebase Console > Project settings > Cloud Messaging > Web Push certificates before deploying. The browser asks for permission after login, registers a `web` push token, and deactivates it on logout. A registered browser can receive order and campaign notifications even when the tab is closed; browser support and user permission still apply.

## Mobile browser theme update - 2026-10-14

- The web entry document now sets the mobile browser theme color to GatedCart orange (`#ff6b00`) instead of purple. This affects supported Android browser status/address-bar styling; the native app and in-app UI are unchanged.

## Live deployment readiness - 2026-10-14

- Authentication is Firebase phone-authentication only. The dummy OTP request and verification API endpoints have been removed.
- Before deployment, configure Firebase Admin credentials, strong JWT access/refresh secrets, the production frontend URL, and persistent image storage in Render.
- Rotate both JWT secrets once after deployment to invalidate sessions created by the removed dummy-login flow.
- No Prisma migration is required for this authentication change. Run the frontend build, backend typecheck, and a real Firebase login smoke test before announcing the live release.

## Ratings and reviews - 2026-10-17

- Customers can optionally rate a completed or delivered order's seller and each product from Order tracking. Ratings are integers from 1 to 5; ratings below 2 require a comment.
- Review comments are stored for administration and support but are not returned with public seller/provider summaries and reviewer identity is not displayed.
- Seller ratings and product rating values are only included in public marketplace responses after the seller enables `Display customer ratings publicly` in Seller Settings. If there are no reviews, no rating value is shown.
- Community service providers accept one rating per authenticated user through `POST /api/v1/service-provider-reviews`; provider aggregates are shown when reviews exist.
- The seller/provider rating migration is `20261017190000_ratings_and_provider_reviews`. Apply it with `npx prisma migrate deploy --schema prisma/schema.prisma` after regenerating Prisma.

## Availability, browser notifications, and rating controls - 2026-10-18

- Seller availability is calculated from the seller's active setting, configured operating hours, and the current `APP_TIME_ZONE` (default `Asia/Kolkata`). `isOpen` is the configured on/off setting; `isCurrentlyOpen` is the effective status at the current weekday and time.
- When a weekly schedule exists, a missing weekday or a closed weekday makes the seller unavailable. Overnight time ranges are supported. Home, storefront, and global-category product results all exclude sellers who are not currently available.
- Seller settings return `isCurrentlyOpen` and `availabilityReason`. The Seller workspace Store status uses the same calculated availability instead of displaying the raw configured `isOpen` value.
- Sellers control public rating visibility in Seller workspace → Settings → `Display customer ratings publicly`. Reviews are still accepted when display is disabled, but public seller and product rating values remain hidden until enabled. Provider ratings are accepted independently.
- Browser notification permission is requested through an in-app prompt only when the signed-in user has an active order, and the prompt is limited to once per day. The browser permission dialog is still controlled by the browser; if permission is blocked, the app explains how to enable it in site settings.
- A granted browser subscription can receive order notifications while the tab is closed through the Firebase Messaging service worker. Logging out deactivates the browser token, so that browser session no longer receives user notifications.
- The latest local verification includes the web production build, backend TypeScript check, Prisma migration status, and `git diff --check`.
