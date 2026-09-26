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

Dummy OTP is always the last five digits of the phone number.

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
- The API service uses `npx prisma migrate deploy --schema prisma/schema.prisma && npm run api:start` as its start command and receives `FRONTEND_URL=https://gatedcart.cheritech.com` and `PORT=10000` through Render environment variables. No seed command is part of deployment.
- The Expo/EAS preview environment uses `EXPO_PUBLIC_WEB_APP_URL=https://gatedcart.cheritech.com` and `EXPO_PUBLIC_API_URL=https://gatedcart-api.onrender.com/api/v1`. The Android preview APK was built successfully and tested against the hosted services.
- The final native launch configuration uses the centered `mobile/assets/icon.png` on a warm `#fff9ef` background; the full `mobile/assets/splash.png` artwork is used by the hosted website splash after the WebView starts.

## Latest marketplace features — 2026-09-26

- Global Admin now manages shared product categories, including category images and active/inactive status.
- Seller product creation uses active global categories; seller-owned category management is removed from the active seller navigation. Products may use `Other` when no shared category applies.
- Customer Home displays global category chips with images. Selecting a category opens products from all approved/open sellers serving the customer's apartment.
- Home carousel promotions support application-wide images and apartment-targeted images. Customers receive both global images and images targeted to their primary apartment.
- Apartment settings contain seller visibility (`Community`, `Outside`, or `Both`) and apartment-specific carousel uploads.
- Carousel images use a consistent responsive display frame with automatic rotation and pointer/touch swiping. Recommended carousel assets are `1200 × 500 px` (12:5); product images are recommended at `1000 × 1000 px`.

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
