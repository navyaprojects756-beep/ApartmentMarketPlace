# Apartment Marketplace API

Base URL: `http://localhost:5000/api/v1`

All protected endpoints use:

```http
Authorization: Bearer <accessToken>
```

## Authentication

- `POST /auth/firebase/exchange` — `{ "idToken": "<Firebase ID token>", "name": "Optional display name" }`; verifies the Firebase phone session and issues the GatedCart API session.
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`

## Customer and marketplace

- `GET /home`
- `GET /apartments`
- `GET /apartments/:apartmentId`
- `POST /apartments/me`
- `GET /sellers`
- `GET /sellers/:sellerId`
- `POST /sellers/apply`
- `GET /sellers/mine`
- `GET /addresses`
- `POST /addresses`
- `PATCH /addresses/:addressId`
- `GET /notifications`
- `POST /notifications/:notificationId/read`
- `GET /important-alerts`
- `POST /notifications/:notificationId/dismiss`
- `POST /reviews`
- `POST /uploads/image` — authenticated local JPEG/PNG/WebP image upload from a data URL
- `GET /account-deletion-requests/mine` — latest deletion request for the authenticated customer.
- `POST /account-deletion-requests` — authenticated customer account deletion request; accepts optional `{ "reason": "..." }`.

### Outside seller registration

Use `https://gatedcart.cheritech.com/?isSellorReg=true` as the private outside-seller registration entry link. The link is not shown in the normal customer UI. After OTP login, a new user sees the outside-seller form without apartment/block/flat residence fields or apartment selection. Seller name, business name, description, and business address are required; the client keeps Submit disabled until all four fields contain text, and the API accepts any non-empty trimmed address. Existing members see a member message and can continue to the normal marketplace. A submitted application remains `PENDING` until Global Admin approval; pending outside sellers see only the pending status on later logins. Approval assigns the `OUTSIDE_SELLER` role, and subsequent normal logins open the customer marketplace first; the Seller Portal remains available through the seller entry point, where delivery areas can be configured.

### Global categories and category browsing

- `GET /home/categories` — active global product categories for the authenticated customer.
- `GET /home/categories/:categoryId/products` — products in a global category from approved/open sellers serving the customer's primary apartment.
- `GET/POST/PATCH/DELETE /admin/categories` — Global Admin category management, including image URL, ordering, active status, and safe deletion checks.
- `GET /seller/catalog-categories` — active global categories available to seller product forms.

## Commerce and delivery

- `GET /carts/:sellerId`
- `POST /carts/:sellerId/items`
- `POST /orders`
- `GET /orders`
- `PATCH /orders/:orderId/status`
- `GET /delivery/orders`
- `POST /delivery/orders/:orderId/assign`
- `PATCH /delivery/orders/:orderId/status`
- `POST /orders/:orderId/verify-items` — seller, assigned delivery boy, or Global Admin verifies the single six-digit order PIN and completes the order.

### Item handover verification

Order creation generates one six-digit order-level `verificationCode`. `GET /orders` returns it to the authenticated customer together with seller, primary apartment/flat context, saved address, items, status history, and delivery assignment.

The request body is `{ "code": "123456" }`. The API checks the single order PIN and seller/delivery/admin scope, and only accepts pickup orders in `READY_FOR_PICKUP` or `PICKED_UP`, or delivery orders in `OUT_FOR_DELIVERY` or `DELIVERED`. Success marks the order `verifiedAt`, changes it to `COMPLETED`, records status history, and notifies the customer.

## Admin and reporting

- `PATCH /admin/apartments/:apartmentId` with `{ sellerDisplayMode: "LOCAL_ONLY" | "OUTSIDE_ONLY" | "BOTH" }` updates seller visibility for one apartment. The UI labels `LOCAL_ONLY` as `Community Sellers`.
- `GET/POST /admin/home-promotions` — application-wide home carousel images.
- `GET/POST /admin/apartments/:apartmentId/home-promotions` — apartment-targeted home carousel images.
- `PATCH /sellers/:sellerId/status`
- `POST /advertisements/requests`
- `GET /advertisements/requests`
- `PATCH /advertisements/requests/:requestId/review`
- `GET /reports/seller/summary` with date, apartment, block, flat, delivery-boy, product, category, status, and fulfillment filters
- `GET /reports/seller/summary.pdf` with the same filters for a server-generated PDF summary
- `GET /seller/dashboard`
- `GET /seller/orders` with status, date, apartment, fulfillment, and search filters
- `POST/PATCH /seller/categories`
- `POST/PATCH /seller/products`
- `POST/DELETE /seller/products/:productId/images`
- `POST /seller/products/:productId/duplicate`
- `POST /seller/inventory/:productId/adjust`
- `GET/POST /seller/delivery-boys`
- `GET /admin/dashboard`
- `GET /admin/orders`
- `GET /admin/audit-logs`
- `GET /admin/error-logs` — Global Admin error diagnostics with request, user, status, and technical details.
- `GET/POST/PATCH /admin/apartments`
- `POST /admin/apartments/:apartmentId/blocks`
- `PATCH /admin/blocks/:blockId`
- `POST /admin/blocks/:blockId/flats`
- `PATCH /admin/flats/:flatId`
- `POST /admin/apartments/:apartmentId/blocks/:blockId/flats/bulk`
- `GET /admin/users`
- `GET /admin/account-deletion-requests` — Global Admin list of customer deletion requests.
- `PATCH /admin/account-deletion-requests/:requestId` — Global Admin status update using `IN_PROGRESS`, `COMPLETED`, `REJECTED`, or `CANCELLED`.
- `GET /admin/sellers`
- `GET/POST /admin/alerts`
- `GET /exports/seller/orders.csv`
- `GET /exports/seller/orders.pdf`
- `GET /exports/seller/orders/:orderId/print.pdf`
- `GET /health`

### Mobile app updates

- `GET /app-update?platform=android` — public version policy read by the Expo shell before loading the WebView.
- `GET /admin/settings/mobile-app-update` — Global Admin reads the Android update policy.
- `PATCH /admin/settings/mobile-app-update` — Global Admin updates `latestVersion`, `minimumVersion`, `mode`, `storeUrl`, `title`, and `message`.

### Maintenance mode

- `GET /maintenance` — public read of the current `{ "enabled": boolean, "message": string }` maintenance configuration for the web/mobile client.
- `GET /admin/settings/maintenance` — Global Admin reads the maintenance configuration.
- `PATCH /admin/settings/maintenance` — Global Admin updates `{ "enabled": boolean, "message": string }`.

The setting is stored in `PlatformSetting` with key `maintenance_mode`. When enabled, the client shows the configured maintenance screen to customers and sellers while Global Admin remains available through the admin portal.

The policy is stored in the `PlatformSetting` row with key `mobile_app_update_policy`. After publishing a new Play Store build, update `latestVersion` in the Global Admin portal under `Settings` → `Mobile app` → `Update policy`. Set `minimumVersion` and `mode` to force an update when required.

Seller-category endpoints remain available only for backward compatibility with existing records; the active seller UI uses `/seller/catalog-categories` and `Product.globalCategoryId` for new and edited products.

### Push notifications

- `POST /push-devices` — authenticated mobile/native clients register an Expo push token with `token`, `platform` (`android` or `ios`), and optional `deviceId`; authenticated browser clients register an FCM Web token with `platform: "web"`.
- `DELETE /push-devices/:token` — authenticated clients deactivate their push token during logout or uninstall cleanup.

The API stores device tokens in `push_devices`. New orders notify the customer and seller; order status changes notify the customer. Expo tokens are delivered through Expo Push Service, while browser tokens are delivered through Firebase Cloud Messaging Web. The browser service worker can display notifications while the tab is closed. Push payloads include `route` and `orderId` data for navigation clients.

### Order references and seller order workflow

New orders receive a customer-facing `orderNumber` in the format `GC-YYMMDD-RANDOM`, for example `GC-261013-X7K4M2`. The field remains globally unique through the database unique constraint; existing orders keep their historical order numbers. The random suffix prevents order-volume disclosure.

The seller Orders workspace supports date filters for Today, Yesterday, and a custom From/To range, together with status filtering. Seller-facing transitions are Accept → Processing → Out for delivery → Delivered for delivery orders, and Accept → Processing → Ready → Handed over for takeaway orders. The persisted API status remains `PREPARING` while the UI displays `Processing`.

Push registration diagnostics log request receipt, authorization presence, authenticated user ID, insert/update operation, and a token suffix only. The API trusts one Render reverse proxy (`app.set('trust proxy', 1)`) so rate-limit client-IP validation works correctly in production.

The native client also listens for Expo/FCM token rotation and re-registers the new token against `POST /push-devices`.

The implementation uses backend scope checks for apartment sellers, outside seller delivery areas, delivery-boy seller/apartment links, order ownership, and admin roles.

## Current client and deployment checkpoint — 2026-09-24

The web and Expo wrapper currently use the same authenticated API-backed application. Customer OTP login, community setup, seller application/status, seller workspace navigation, cart/checkout, order tracking, seller order actions, and admin navigation are wired through the documented API boundary. The OTP input uses a visual dash placeholder only; the backend contract remains unchanged and still validates the development OTP.

### Hosted API configuration

- Production API base URL: `https://gatedcart-api.onrender.com/api/v1`
- Production web origin: `https://gatedcart.cheritech.com`
- Browser builds read the API base URL from `VITE_API_URL`.
- Expo/EAS builds read the API base URL from `EXPO_PUBLIC_API_URL` and the hosted web URL from `EXPO_PUBLIC_WEB_APP_URL`.
- The backend CORS setting must use `FRONTEND_URL=https://gatedcart.cheritech.com`.
- Render services should use the internal PostgreSQL connection URL. External PostgreSQL credentials are only for local tools such as pgAdmin.
- The native launch screen and launcher icon are packaged by Expo and are independent of the API; the WebView then loads the hosted frontend and uses the API base URL above.
## Multi-seller checkout and deployment behavior

The customer cart groups items by seller and submits one `POST /orders` request for each seller. Each request creates an independent order with its own status history, inventory changes, seller queue entry, and order number. Customer order tracking retrieves the resulting orders through `GET /orders`.

The Render API start command runs `npx prisma migrate deploy --schema prisma/schema.prisma && npm run api:start`. The `api:start` script regenerates Prisma Client from the checked-in schema before launching the server, then committed Prisma migrations are applied automatically during API deployment. Existing records are preserved unless a migration explicitly changes data. `prisma/seed.ts` is not part of the Render start command and does not run automatically.

## Community services

- `GET /home` — includes authenticated apartment-scoped community services for the customer Home screen.
- `GET /home/community-services/:serviceId/providers` — authenticated providers available in the customer's apartment.
- `GET/POST/PATCH/DELETE /admin/community-services` — Global Admin service-category management.
- `GET/POST/PATCH/DELETE /admin/community-service-providers` — Global Admin provider management, including image URL and apartment IDs.

The customer-facing deletion URL is `https://gatedcart.cheritech.com/delete-account`. It requires login and then submits the request through the customer endpoints above. The policy URLs are `https://gatedcart.cheritech.com/privacy-policy` and `https://gatedcart.cheritech.com/terms-and-conditions`.


## Order fulfillment snapshots - 2026-10-04

`POST /orders` captures fulfillment contact data inside the order transaction:

- For `PICKUP`, the order stores the seller pickup address and seller phone.
- For `DELIVERY`, the order stores the selected customer delivery address and customer phone.

`GET /orders` returns the saved order-time values for new orders. These values are represented in the customer order detail as the takeaway pickup address/phone or delivery-to address/phone. They are not recalculated from the customer profile or seller settings after checkout.

The database fields are:

- `orders.fulfillment_address` - nullable text snapshot.
- `orders.fulfillment_phone` - nullable phone snapshot.

Migration: `20261004170000_order_fulfillment_snapshots`. Existing orders from before this migration remain compatible but may fall back to their existing relational address data.

Customer cancellation is confirmed through the frontend's in-app modal before the existing `PATCH /orders/:orderId/status` cancellation request is sent.

## Web client theme metadata - 2026-10-14

The browser theme color is configured in the root web document as GatedCart orange (`#ff6b00`). This is a client-shell setting and does not change API behavior or require a backend migration.

## Authentication release contract - 2026-10-14

`POST /auth/firebase/exchange` is the only login exchange endpoint. The client sends a verified Firebase phone ID token; the API validates it with Firebase Admin and returns the GatedCart access and refresh tokens. The removed dummy OTP endpoints must not be used by clients or deployment smoke tests.
