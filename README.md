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
