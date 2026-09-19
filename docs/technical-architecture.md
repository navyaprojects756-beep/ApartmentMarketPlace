# Apartment Marketplace — Technical Architecture

## Purpose

This document records implementation decisions, technical structure, database conventions, API conventions, and deployment notes. The functional business requirements remain in `apartment_marketplace_full_project_prompt.md`.

## Current architecture

- Frontend: React + Vite prototype, evolving toward a shared responsive web/mobile application.
- Mobile target: React Native + Expo with shared feature and domain code.
- Backend target: Node.js + Express + TypeScript.
- Persistence: PostgreSQL with Prisma ORM.
- Authentication: phone number + dummy OTP for local development; JWT access and refresh tokens.
- File storage: local filesystem abstraction for development.
- Local operations: native PostgreSQL or optional Docker Compose PostgreSQL service.
- API style: versioned REST under `/api/v1`.
- Validation: Zod at API boundaries.
- Authorization: backend-enforced RBAC and resource-scope checks.

## Implemented API foundation

- `GET /api/v1/health` — API and PostgreSQL health.
- `POST /api/v1/auth/request-otp` — local dummy OTP generation.
- `POST /api/v1/auth/verify-otp` — OTP verification and token issuance.
- `POST /api/v1/auth/refresh` — refresh-token rotation.
- `POST /api/v1/auth/logout` — revoke active refresh sessions.
- `GET /api/v1/auth/me` — authenticated user, roles, and community associations.
- `GET /api/v1/home` — authenticated home data with backend-filtered seller collections.
- `GET /api/v1/sellers` — sellers eligible for the user's current apartment.
- `GET /api/v1/sellers/:sellerId` — scoped seller storefront with active categories, products, and approved seller-specific advertisements.
- `GET /api/v1/admin/settings/home-seller-display-mode` — Global Admin setting read.
- `PATCH /api/v1/admin/settings/home-seller-display-mode` — Global Admin setting update with audit log.
- `GET /api/v1/apartments` and `GET /api/v1/apartments/:apartmentId` — community selection data.
- `POST /api/v1/apartments/me` — set the authenticated user's current apartment/block/flat.
- `POST /api/v1/sellers/apply` — seller application with apartment-scope validation.
- `GET /api/v1/sellers/mine` — current user's seller application/profile.
- `PATCH /api/v1/sellers/:sellerId/status` — Global Admin seller approval/status action.
- `GET/POST /api/v1/carts/:sellerId` and `/items` — seller-scoped cart operations.
- `POST /api/v1/orders` — authoritative transactional checkout.
- `GET /api/v1/orders` — customer order history.
- `PATCH /api/v1/orders/:orderId/status` — validated order transition.
- `GET /api/v1/delivery/orders` — delivery-boy scoped order list.
- `POST /api/v1/delivery/orders/:orderId/assign` — seller/admin delivery assignment validation.
- `PATCH /api/v1/delivery/orders/:orderId/status` — delivery-boy status updates.
- `POST /api/v1/advertisements/requests` — user/seller advertisement request.
- `GET /api/v1/advertisements/requests` — Global Admin pending requests.
- `PATCH /api/v1/advertisements/requests/:requestId/review` — approve/reject advertisement.
- `GET /api/v1/reports/seller/summary` — seller date-range summary report.
- `GET/POST /api/v1/addresses` and `PATCH /api/v1/addresses/:addressId` — customer addresses.
- `GET /api/v1/notifications` and `POST /api/v1/notifications/:notificationId/read` — notification state.
- `GET /api/v1/important-alerts` and `POST /api/v1/notifications/:notificationId/dismiss` — targeted important-alert read/dismiss state.
- `POST /api/v1/reviews` — completed-order review creation.
- `GET /api/v1/seller/dashboard` — seller KPI and low-stock summary.
- `GET /api/v1/seller/orders` — seller-scoped order queue with status, date, apartment, fulfillment, and customer search filters.
- `POST/PATCH /api/v1/seller/categories` — seller category management.
- `POST/PATCH /api/v1/seller/products` — seller product management.
- `POST/DELETE /api/v1/seller/products/:productId/images` and `POST /api/v1/seller/products/:productId/duplicate` — seller-owned product media and duplication.
Product duplication starts disabled and with zero inventory, preserving seller review before the duplicate becomes orderable.
- `POST /api/v1/seller/inventory/:productId/adjust` — inventory movement and adjustment.
- `GET/POST /api/v1/seller/delivery-boys` — delivery staff management.
- `GET /api/v1/admin/dashboard`, `/orders`, and `/audit-logs` — administrative monitoring.
- `GET/POST/PATCH /api/v1/admin/apartments` plus block/flat create, edit/deactivate, and bulk-import endpoints — apartment hierarchy administration.
- `GET /api/v1/admin/users` and `/sellers` — platform monitoring.
- `GET/POST /api/v1/admin/alerts` — important alert management with apartment targeting.
- `GET /api/v1/exports/seller/orders.csv` — CSV export.
- `GET /api/v1/exports/seller/orders.pdf` — PDF export using server-side PDF generation.
- `GET /api/v1/exports/seller/orders/:orderId/print.pdf` — scoped print-friendly individual order PDF.

Admin resource routes are intentionally Global Admin-only. Apartment, block, flat, user, seller, and alert operations are written through the same authenticated API boundary as the dashboards; important alerts are stored as approved advertisement records with optional apartment targets and audit entries.
Block and flat bulk import uses idempotent upserts keyed by apartment, block, and flat number, allowing safe repeat imports without duplicate hierarchy rows.

Endpoint inventory is documented in `docs/api.md`.

Checkout locks tracked inventory rows inside a PostgreSQL transaction, recalculates product prices from the database, creates order history, records inventory movements, and creates an order notification.

Seeded local accounts use the last five digits of the phone number as the dummy OTP.

## Repository layout

```text
src/                         Current responsive web prototype
prisma/schema.prisma         Canonical database schema
prisma/migrations/           Applied database migrations
docs/                        Technical and progress documentation
backend/                     Backend API service (being implemented)
```

## Database decisions

- UUID primary keys are used for business entities.
- Historical order data is protected with restrictive foreign keys where appropriate.
- Soft deactivation fields are used for apartments, sellers, products, categories, and users.
- Seller visibility is always resolved on the backend.
- `PlatformSetting` stores business configuration such as `home_seller_display_mode`.
- Money values use PostgreSQL `numeric` through Prisma `Decimal`.
- Inventory changes and order creation must use transactions and row-level protection.

## Home seller visibility

`home_seller_display_mode` accepts:

- `LOCAL_ONLY`
- `OUTSIDE_ONLY`
- `BOTH`

The home API returns only permitted sellers for the authenticated user's apartment. The frontend never receives a complete unrestricted seller list for client-side filtering.

## Local environment

Required root `.env` values:

```env
DATABASE_URL="postgresql://..."
JWT_ACCESS_SECRET="replace-for-local-development"
JWT_REFRESH_SECRET="replace-for-local-development"
PORT=5000
```

Never commit `.env` or production secrets.

## Delivery and release direction

- Web is developed as a responsive application and can be deployed as a static build plus API.
- Android and iOS will use Expo/EAS once the shared customer flows are connected to the API.
- Play Store release requires the user's Google Play Console account, application ID, signing credentials, store listing, privacy policy, and final production approval. The project will be made build-ready; publishing requires those external account actions.

## Client preview navigation

- Customer marketplace: `/`
- Seller dashboard: `/?role=seller`
- Delivery dashboard: `/?role=delivery`
- Global Admin dashboard: `/?role=admin`
- Mobile shell: `mobile/`

The customer web app starts with phone/OTP authentication, stores the local development access token in browser storage, requests Home and seller/product data with the bearer token, and submits cart checkout through the order API. API fallback data remains available for visual development when the backend is offline.
The seed catalog is deterministic and contains more than 50 products across seller-owned categories, with both inventory-tracked and manually available products so inventory and catalog workflows can be exercised locally.
Seed sellers cover apartment and outside models, including multiple outside delivery areas and a single delivery-boy identity linked to multiple sellers.
Initial media uses `POST /uploads/image` with a validated image data URL; `storage.service.ts` writes generated safe filenames under `uploads/`, which is served at `/uploads/*`. The service boundary can be replaced with object storage without changing marketplace entities.
Customer Orders renders the API-provided status history and delivery assignment details; pending cancellation uses the same backend transition validator as seller actions.
Checkout uses `/addresses` and `/home` to load the user's community context, persists a default delivery address when needed, and sends `addressId` to transactional order creation.
When an authenticated user has no primary community association, the web client routes to a community setup screen backed by `/apartments` and `/apartments/me`; it supports optional blocks, predefined flats, and manual flat numbers before requesting Home again.
The customer Profile navigation exposes seller application creation/status through `/sellers/apply` and `/sellers/mine`, enforcing apartment/outside scope in the backend.
The same authenticated profile workspace submits normal advertisement requests through `/advertisements/requests` and reads requester status through `/advertisements/requests/mine`; Global Admin review remains protected by the advertisement review route.
The responsive Global Admin preview at `/?role=admin` authenticates against the seeded admin account, reads the active home seller display mode, and updates it through the protected settings API.
The same admin workspace loads `/admin/apartments`, supports apartment activation changes through `PATCH /admin/apartments/:id`, and publishes targeted alerts through `POST /admin/alerts`.
It also loads pending advertisement requests and reviews them through `PATCH /advertisements/requests/:requestId/review`, with approval creating the scheduled advertisement and audit record in one transaction.
Seller management loads `/admin/sellers` and changes application status through the audited `PATCH /sellers/:sellerId/status` endpoint.
The Delivery preview at `/?role=delivery` authenticates the seeded delivery account, loads only its seller/apartment-scoped queue, and sends status changes through the backend transition validator.
The Seller preview at `/?role=seller` authenticates the seeded seller account, loads `/seller/orders`, and submits seller status transitions through `/orders/:orderId/status`; invalid transitions remain rejected by the API.
The same seller surface loads `/sellers/mine` and scoped storefront products, creates products through `/seller/products`, and adjusts tracked stock through `/seller/inventory/:productId/adjust`.
Seller catalog controls also create/deactivate categories through `/seller/categories` and toggle product availability through `PATCH /seller/products/:productId`; all writes remain seller-scoped.
The customer storefront uses the returned category IDs for filtering and places the first approved seller advertisement above the live product menu.
The deterministic local seed now includes six named sellers spanning apartment-local and outside-seller scopes, shared delivery coverage, and more than 50 products across multiple seller categories; integration tests assert that storefront categories, advertisements, and products are returned together.
The seller order workspace assigns ready orders through `POST /delivery/orders/:orderId/assign`; the backend only accepts active delivery users linked to both the seller and the order apartment.
Seller reporting now uses `/reports/seller/summary?from=...&to=...` for live date-filtered order, sales, cancellation, average-order, and unit metrics.
The report query additionally accepts apartment, block, flat, delivery-boy, product, category, status, and fulfillment filters; `/reports/seller/summary.pdf` produces the same filtered summary server-side with PDFKit.
The responsive seller workspace exposes the most common report filters and downloads the PDF with the authenticated session rather than exposing a public report URL.
Seller operations also load linked delivery staff through `/seller/delivery-boys` and can create/link a delivery user to one or more apartments through the same protected resource.
Customer Home maps the approved, apartment-scoped advertisement collection from `/home` into the horizontal banner carousel and surfaces `IMPORTANT_ALERT` records as a dismissible announcement block.
Customer Home also adopts the `/home.mode` response (`LOCAL_ONLY`, `OUTSIDE_ONLY`, or `BOTH`) before rendering seller navigation; the selector is only available when the backend mode is `BOTH`, and disabled seller collections are never reconstructed client-side.
Global Admin important-alert creation creates targeted `IMPORTANT_ALERT` notifications for residents in selected apartments (or all residents when untargeted). Customer alert responses include notification read/dismiss timestamps, and dismissals are persisted through the notification-read relation.

Expo configuration and Android bundle export are verified with:

- Android package: `com.nivasa.marketplace`
- iOS bundle identifier: `com.nivasa.marketplace`

Production Android/iOS builds still require EAS credentials, signing configuration, and store account metadata.
The Android preview export has been revalidated from the `mobile` workspace after the native mode-control fix.
The mobile project includes `assets/icon.svg` and `assets/splash.svg` as deterministic branded source assets; final store-specific raster/adaptive icon packaging remains part of the external release pass.
The detailed process is tracked in `docs/release-checklist.md`.
The mobile API client uses `EXPO_PUBLIC_API_URL`; Android emulator development defaults to `http://10.0.2.2:5000/api/v1` when no environment override is supplied.
The mobile entry flow now performs dummy-OTP authentication, loads backend-scoped Home data, supports Local/Outside/Both filters and Orders history, and can preview seller, delivery, or admin API workspaces using `EXPO_PUBLIC_ROLE_PREVIEW`. Seller previews advance valid order statuses, delivery previews advance assigned delivery statuses, and admin previews read/update the protected home seller display mode.
The native customer Home screen now mirrors the server-enforced seller mode: it only renders the Local/Outside/Both selector when the mode is `BOTH`, and its memoized seller list remains limited to the collections returned by the scoped Home API.
Customer discovery uses `GET /api/v1/search?q=...`; the backend applies the resident apartment relationship and effective home seller display mode before returning sellers, categories, or products.
Completed customer orders can be reviewed once per order/product through `POST /api/v1/reviews`; `GET /api/v1/sellers/:sellerId/reviews` returns the scoped average, count, and recent review summaries.
Seller settings are managed through `GET/PATCH /api/v1/seller/settings`, including store profile, open state, delivery/pickup availability, charges, minimum order, and operating-hour records. Global Admin user updates are audited, protect the final active admin, and order monitoring supports status, seller, apartment, and text filters.
Order status changes are transactional and audited; cancelling a previously stocked order restores each tracked product quantity and records a `CANCELLED_ORDER` inventory movement.
Checkout supports both `DELIVERY` and `PICKUP`; the backend enforces seller capabilities and authoritative product/seller scope for either fulfillment path.
Delivery queue reads support optional apartment, seller, status, and grouping parameters while preserving seller/apartment assignment scope.
The active web customer storefront uses shared cart state with quantity controls and a bottom-only cart CTA. Cart state is seller-scoped: an attempted item from another seller opens a confirmation toast, and confirmation clears the previous seller's cart before adding the new item. The authenticated browser session is restored from local storage until the user explicitly signs out; Profile contains read-only community details plus an editable apartment/block/flat registration form backed by `POST /apartments/me`, seller registration, advertisement requests, and logout.
Customer OTP requests bootstrap the role catalog when the database is empty, create or reuse the mobile user as a `CUSTOMER`, and use the last five phone digits as the local development OTP. The reserved Global Admin number is `9493499405`; `/admin` is a separate browser portal for protected Global Admin operations, including apartments, blocks, flats, user role assignment, seller approvals, alerts, orders, and platform controls.
When Global Admin assigns `APARTMENT_SELLER` or `OUTSIDE_SELLER`, the backend prepares a pending seller profile if one does not exist. The next OTP login detects the seller role and opens the live Seller Portal; outside sellers can submit apartment delivery areas for approval, while apartment sellers remain scoped to their own apartment. Seller operations use the protected settings, catalog, inventory, order, delivery-area, and reporting APIs.

## Requirements audit status

The current repository is a working V1 MVP rather than a finished production release. Core commerce and authorization paths are connected end to end. Remaining implementation is concentrated in global search, review/rating presentation, operating-hours and delivery-configuration management, complete pickup and delivery grouping workflows, full Global Admin management/report screens, broader concurrency/cancellation/export tests, and native screen parity. External hosting, signing, device QA, and store publication are intentionally not represented as completed local code features.

## Decision log

| Date | Decision |
|---|---|
| 2026-09-19 | Prisma 6.19.1 is used for stable local migration workflow. |
| 2026-09-19 | `BOTH` is the default home seller display mode. |
| 2026-09-19 | The existing visual prototype remains the first web UI reference while backend implementation begins. |
- Order views use the authenticated commerce and seller-order APIs. Both order queries include seller/customer context, apartment, block, flat, saved address, items, delivery assignment and status history. Seller print uses the protected `/exports/seller/orders/:orderId/print.pdf` endpoint; customer print uses the browser print action. Seller status transitions are presented as explicit actions mapped to the backend transition rules.
- Dashboard navigation is role-aware at the application entry point: customers use Home, Orders and Profile; sellers use their fulfilment workspace; Global Admin uses the admin workspace. Responsive CSS keeps the same navigation model on desktop, tablet and phone layouts, with phone dashboards using a labeled bottom navigation bar.
