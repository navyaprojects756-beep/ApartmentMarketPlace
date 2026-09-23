# Apartment Marketplace API

Base URL: `http://localhost:5000/api/v1`

All protected endpoints use:

```http
Authorization: Bearer <accessToken>
```

## Authentication

- `POST /auth/request-otp` — `{ "phone": "9000000010" }`
- `POST /auth/verify-otp` — `{ "phone": "9000000010", "otp": "00010" }`
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

## Commerce and delivery

- `GET /carts/:sellerId`
- `POST /carts/:sellerId/items`
- `POST /orders`
- `GET /orders`
- `PATCH /orders/:orderId/status`
- `GET /delivery/orders`
- `POST /delivery/orders/:orderId/assign`
- `PATCH /delivery/orders/:orderId/status`

## Admin and reporting

- `PATCH /admin/apartments/:apartmentId` with `{ sellerDisplayMode: "LOCAL_ONLY" | "OUTSIDE_ONLY" | "BOTH" }` updates seller visibility for one apartment. The UI labels `LOCAL_ONLY` as `Community Sellers`.
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
- `GET/POST/PATCH /admin/apartments`
- `POST /admin/apartments/:apartmentId/blocks`
- `PATCH /admin/blocks/:blockId`
- `POST /admin/blocks/:blockId/flats`
- `PATCH /admin/flats/:flatId`
- `POST /admin/apartments/:apartmentId/blocks/:blockId/flats/bulk`
- `GET /admin/users`
- `GET /admin/sellers`
- `GET/POST /admin/alerts`
- `GET /exports/seller/orders.csv`
- `GET /exports/seller/orders.pdf`
- `GET /exports/seller/orders/:orderId/print.pdf`
- `GET /health`

The implementation uses backend scope checks for apartment sellers, outside seller delivery areas, delivery-boy seller/apartment links, order ownership, and admin roles.

## Current client checkpoint — 2026-09-23

The web and Expo wrapper currently use the same authenticated API-backed application. Customer OTP login, community setup, seller application/status, seller workspace navigation, cart/checkout, order tracking, seller order actions, and admin navigation are wired through the documented API boundary. The OTP input uses a visual dash placeholder only; the backend contract remains unchanged and still validates the development OTP.
