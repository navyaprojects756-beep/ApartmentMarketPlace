# Database-free regression test plan

This suite is safe to run against the live codebase because the default `npm test` command runs only `tests/unit-regression.test.ts`. It does not import Prisma, start the API, call Firebase, write uploads, send notifications, or modify a database.

The existing seeded HTTP/database tests remain available separately as `npm run test:integration`. Run those only against a disposable test database, never production.

## Automated database-free cases

The default suite covers:

- Seller active/inactive state, empty schedules, missing weekdays, and overnight hours.
- Home seller visibility for Community, Outside, Both, apartment scope, approval, and closed sellers.
- JPEG/PNG/WebP data URL validation, malformed input, empty payloads, and size limits.
- Cart subtotal, coupon discount cap, delivery charge, and final total calculation.
- Inventory quantity validation, unavailable products, exact stock use, and oversell prevention.
- Valid forward order lifecycle transitions and terminal-order protection.
- Inclusive admin/customer/order date filtering.

Run it with:

```bash
npm test
```

## UI and backend acceptance matrix

| Area | UI case | Backend/business case | Expected result |
|---|---|---|---|
| Authentication | Firebase phone login, logout, expired session | Token exchange and authorization middleware | User reaches only permitted workspace; invalid/expired tokens are rejected |
| Onboarding | Select apartment, block, flat, or manual flat | Association is scoped to authenticated user | Home data uses the selected primary apartment |
| Home | Switch Community/Outside/Both visibility | Seller type, approval, apartment, delivery area, and availability filters | No ineligible seller is shown |
| Search | Search product, seller, category, service, empty search | Search results are scoped to accessible records | Overlay results are accurate; empty state is shown |
| Categories | Open active category; view disabled empty category | Product counts include only available eligible products | Correct category products appear |
| Storefront | Open seller, banner, tabs, ads, availability label | Seller and product response is apartment-scoped | Closed/unapproved sellers are unavailable |
| Product images | Select, crop, zoom, drag, use image, add/delete images | Upload accepts only allowed formats and size | Product output is 1200×900, full image remains inside 4:3 frame |
| Seller banner | Select/crop/use banner and view customer store | Upload output is normalized | Banner output is 1200×500 with no top/bottom gaps |
| Cart | Add/remove, multi-seller groups, coupon, delivery mode | Totals and stock are recalculated server-side | One seller group/order; discount never reduces delivery charge |
| Checkout | Address/takeaway selection and confirmation | Transaction validates price, stock, seller, coupon, fulfillment snapshot | No oversell; immutable order-time contact details |
| Orders | Customer tracking, cancellation, review | Status transitions, PIN verification, snapshots, ratings | Invalid transitions/PINs are rejected |
| Seller products | Create/edit/duplicate/deactivate, inventory | Seller ownership and validation | Seller cannot alter another seller’s product |
| Seller orders | Lifecycle bar, accept/processing/ready/delivery | Authorized status transition and history | Terminal orders cannot be changed |
| Delivery | Assigned orders, pickup/out-for-delivery/delivered | Assignment and apartment/seller scope | Delivery staff sees only assigned eligible work |
| Coupons | Create, deactivate, apply, minimum subtotal | Date, apartment, first-order, usage, and seller rules | Coupon is revalidated during checkout |
| Advertisements | Upload, submit, approve/reject, carousel | Requester/admin/target authorization | Only approved active ads are public |
| Community services | Browse service/provider, image preview, review | Apartment provider scope and rating rules | Ineligible providers are hidden |
| Admin | Users, apartments, sellers, orders, filters, maintenance | Role checks and protected mutations | Customer/seller cannot access admin operations |
| Notifications | Order/campaign/browser/native prompts | Token registration and notification targeting | No notification is sent outside authorized scope |
| Reports/exports | View filters, CSV/PDF/print | Seller ownership and date/apartment filters | Export contains only authorized records |
| Mobile WebView | Navigation, refresh restoration, upload crop, responsive frames | Same API authorization and validation | Web behavior remains consistent without native rebuild for web-only changes |

## Safe test-data rules

- Use in-memory objects and fixed dates in unit tests.
- Never call `npm run db:seed` as part of a regression test.
- Never point integration tests at the production `DATABASE_URL`.
- Use a disposable database and separate credentials for `npm run test:integration`.
- Do not test uploads by writing to the repository `uploads/` directory in the default suite.
- Product variants: enable a shared option name, add different prices/discounts, edit stock only, deactivate old options, and verify selected options in cart/orders.
- Add a regression test before changing a business rule, then run `npm test` and the relevant UI smoke cases.
