# Apartment Marketplace — Development Progress

This is the restart/checkpoint document. Update it whenever a meaningful development phase is completed.

## Status legend

- `[x]` Complete and verified
- `[~]` In progress
- `[ ]` Not started
- `[!]` Blocked or requires an external decision

## Overall status

Current phase: Client integration, end-to-end workflows, and release verification.

Last checkpoint: 2026-09-19

Verification checkpoint: database migration status, web build, backend build, Android export, and 11 database-backed HTTP/core tests pass.

## Completed

- [x] Functional requirements documented in `apartment_marketplace_full_project_prompt.md`.
- [x] Responsive purple customer Home and Seller Storefront visual prototype created.
- [x] Home seller display modes demonstrated: Local, Outside, Both.
- [x] PostgreSQL connection configured in local `.env`.
- [x] Prisma schema created for core marketplace entities.
- [x] Initial migration applied successfully to `apartment_marketplace`.
- [x] Prisma Client generated successfully.
- [x] Database migration status verified as up to date.
- [x] Backend TypeScript service scaffold created.
- [x] Environment validation added.
- [x] Prisma service and database health check added.
- [x] Security middleware baseline added: Helmet, CORS, JSON limits, logging, and rate limiting.
- [x] API build verified with `npm run api:build`.
- [x] API running at `http://localhost:5000`.
- [x] `/api/v1/health` verified with database status `connected`.
- [x] Dummy OTP request and verification APIs implemented.
- [x] JWT access and refresh token flow implemented.
- [x] Authenticated `/api/v1/auth/me` endpoint verified.
- [x] Authentication middleware and role middleware added.
- [x] Seed script created and executed successfully.
- [x] Seed data includes all roles, four apartments, sellers, products, inventory, delivery assignments, advertisements, settings, and sample orders.
- [x] Seed catalog expanded to at least 50 realistic products across 10 seller categories, with tracked and untracked inventory examples.
- [x] Seed landscape expanded with six named sellers, multiple apartment/outside scopes, and shared delivery-boy seller links.
- [x] Seed data now covers the full documented order lifecycle, including cancellation and completion states.
- [x] Backend Home API enforces local/outside/both seller visibility from PostgreSQL.
- [x] Seller list and seller storefront/product APIs added with apartment-scope checks.
- [x] Global Admin home seller display-mode read/update API added with audit logging.
- [x] Home API verified: `BOTH`, one local seller, one outside seller for seeded customer.
- [x] Apartment list/detail and current-user community selection APIs added.
- [x] Seller application API added for apartment/outside sellers.
- [x] Global Admin seller approval/status API added with audit logging.
- [x] Apartment API verified with all four seeded apartments.
- [x] Seller carts and cart-item APIs added.
- [x] Transactional checkout/order creation added with authoritative database prices.
- [x] Inventory row locking and stock decrement added for tracked products.
- [x] Customer order history and valid status-transition API added.
- [x] Important alerts now create targeted per-user notification state with authenticated read/dismiss APIs.
- [x] Checkout verified by creating a live PostgreSQL order from the seeded customer.
- [x] Delivery-boy eligible-order, assignment, and delivery-status APIs added.
- [x] Advertisement request, admin review, approval, and active-ad APIs added.
- [x] Seller summary reporting API added.
- [x] Responsive Home prototype now loads seller data from the live Home API with offline preview fallback.
- [x] Web production build and backend TypeScript build both pass.
- [x] Central validation and Prisma error responses added to API middleware.
- [x] Seller management APIs added for dashboard, categories, products, inventory adjustments, and delivery staff.
- [x] Seller product image upload/remove and safe duplicate-product APIs added.
- [x] Seller filterable order queue and individual print-friendly PDF order export added.
- [x] Global Admin dashboard, order monitoring, and audit-log APIs added.
- [x] Seller CSV order export added and verified.
- [x] Server-side seller PDF order export added and verified with HTTP 200.
- [x] API reference documentation created in `docs/api.md`.
- [x] Addresses, notifications, and completed-order review APIs added.
- [x] Database-backed critical-rule test suite added.
- [x] Shareable `.env.example` and optional PostgreSQL `docker-compose.yml` added with README setup instructions.
- [x] Local image storage abstraction added with validated JPEG/PNG/WebP data-URL upload, safe filenames, static serving, and integration coverage.
- [x] Core-rule tests verified against the seeded PostgreSQL database.
- [x] Core-rule tests now enforce the 50-product, 10-category, and inventory seed minimums.
- [x] Core-rule tests enforce the multi-seller seed minimum.
- [x] HTTP integration tests added for customer authentication, Home visibility, admin authorization, and seller dashboard access.
- [x] HTTP integration coverage verifies Global Admin Home mode updates are enforced in the customer Home response.
- [x] Responsive Seller, Delivery, and Global Admin dashboard surfaces added to the web client.
- [x] Responsive Seller dashboard now loads a protected order queue and exposes valid Accept, Preparing, and Ready actions.
- [x] Seller dashboard now includes live product creation and tracked-inventory adjustment controls.
- [x] Seller dashboard now includes category creation/deactivation and product availability controls.
- [x] Seller dashboard now includes date-filtered live sales reporting metrics.
- [x] Responsive Delivery dashboard now loads the protected delivery queue and exposes valid status actions.
- [x] Role preview navigation added: `/?role=seller`, `/?role=delivery`, and `/?role=admin`.
- [x] Expo Android/iOS mobile shell created under `mobile/` with package identifiers and shared customer Home starter screen.
- [x] OpenAPI JSON endpoint added at `/api-docs/openapi.json`.
- [x] OpenAPI inventory extended for alert state, seller order queue, and admin alert management.
- [x] Main README updated with setup, seed, API, client, and validation workflows.
- [x] Mobile dependencies installed and Expo configuration verified with Android/iOS package identifiers.
- [x] EAS development/preview/production profiles and mobile release checklist added.
- [x] Mobile Home shell now includes a shared API client and seeded Home API loading with offline fallback.
- [x] Expo SDK-compatible mobile dependencies aligned and Android export smoke test passed.
- [x] Mobile customer authentication, Home visibility filters, Orders history, and role-aware API preview entry points wired.
- [x] Branded mobile icon and splash source assets added and Expo configuration/export verified.
- [x] Responsive web customer login flow added for phone + dummy OTP.
- [x] Responsive customer community onboarding added for apartment, block, predefined-flat, and manual-flat selection.
- [x] Responsive customer seller-application flow added for apartment and outside sellers, including delivery-area selection and application status.
- [x] Responsive authenticated advertisement-request form and request-status list added to the customer profile workspace.
- [x] Community onboarding HTTP integration test verifies a new phone user can select an apartment and manual flat before Home access.
- [x] Web Home now loads using the authenticated access token stored in local session storage.
- [x] Customer storefront now loads live products from the seller API.
- [x] Customer storefront now renders live seller-specific advertisements and category-driven product filters.
- [x] Customer storefront supports adding products to a cart and submitting checkout through the order API.
- [x] Customer Orders screen loads authenticated order history and status from the Orders API.
- [x] Customer Orders screen now exposes expandable status timelines, delivery assignment details, and pending-order cancellation.
- [x] Customer checkout now loads saved addresses, supports adding a community address, and submits the selected address with delivery orders.
- [x] Seller, Delivery, and Global Admin dashboard metrics now load from live role APIs with preview fallback.
- [x] Responsive Global Admin preview now reads and updates the backend home seller visibility setting.
- [x] Responsive Global Admin workspace now manages apartment activation and publishes targeted important alerts.
- [x] Responsive Global Admin workspace now reviews pending advertisement requests with approve/reject actions.
- [x] Responsive Global Admin workspace now loads seller applications and exposes audited status changes.
- [x] Web and mobile customer Home now honor the backend effective seller display mode; single-type modes hide the Both/Local/Outside selector.
- [x] Customer Home now consumes approved scoped advertisements and presents important-alert announcements with dismissible UI.
- [x] Global Admin apartment hierarchy, user/seller monitoring, and important-alert management APIs added.
- [x] Global Admin block/flat edit-deactivate and bulk flat import APIs added and integration-tested.
- [x] Admin resource monitoring endpoints covered by HTTP integration tests.

## Current implementation phase

- [x] Backend service structure.
- [x] Express application and health endpoint.
- [x] Authentication and dummy OTP APIs.
- [x] JWT access/refresh token handling.
- [x] RBAC middleware.
- [x] Seed data for every role and major workflow.
- [x] OpenAPI/API documentation.
- [x] Automated backend tests.

## Planned phases

### Phase 1 — Backend foundation

- [x] Backend TypeScript service.
- [x] Environment validation.
- [x] Prisma service and error handling.
- [x] Logging, CORS, rate limiting, and security headers.
- [x] Authentication, RBAC, and audit helpers.

### Phase 2 — Core marketplace APIs

- [x] Apartments and community selection.
- [x] Seller registration and approval.
- [x] Home visibility API.
- [x] Categories, products, inventory, and seller storefront read APIs.

### Phase 3 — Commerce APIs

- [x] Carts and checkout.
- [x] Transactional orders and inventory locking.
- [x] Order status transitions and notifications.
- [x] Reviews and addresses.

### Phase 4 — Delivery, advertisements, and admin

- [x] Delivery-boy assignment and workflow.
- [x] Advertisement requests and approvals.
- [x] Important alerts foundation through advertisement alert types.
- [x] Admin settings and audit logs.
- [x] Reports API foundation and seller CSV export.

### Phase 5 — Client applications

- [~] Connect responsive web UI to APIs; customer commerce flows, seller operations, delivery operations, reporting, and Global Admin resource controls are connected. Native role-specific workflows and external release work remain.
- [x] Seller dashboard surface, including live order queue transitions, product/stock controls, reporting filters, and delivery-staff linking.
- [x] Seller web order queue now assigns eligible delivery staff through the protected seller/apartment scope API.
- [x] Delivery dashboard surface.
- [x] Global admin dashboard surface.
- [~] Shared Expo Android/iOS application includes authenticated customer Home/Orders plus API-backed seller order actions, delivery status actions, and admin home-visibility controls; native product/report/admin resource parity and external release work remain.
- [x] Android/iOS release configuration foundation.
- [ ] Play Store-ready bundle and release checklist.

## Resume instructions

1. Read this file and `docs/technical-architecture.md`.
2. Check the latest migration and working tree.
3. Run `npm run db:status` when available.
4. Continue from the first unchecked item in the current phase.
5. Update this file immediately after completing and verifying a phase item.

## Current blockers

- [!] Play Store publication itself requires the user's Google Play Console account and signing/release decisions.

## Requirements audit after full prompt review — 2026-09-19

- [x] Core V1 foundation is implemented: PostgreSQL/Prisma, authentication, RBAC, apartment scope, home visibility enforcement, seller storefront, products, inventory, cart/checkout, orders, delivery assignment/status, advertisements, alerts, reports, PDF/CSV foundations, local storage, responsive web surfaces, seed data, and critical API tests.
- [~] Website still needs the remaining specification-level management surfaces: review submission UI and product rating summaries, richer operating-hours editing, complete admin audit/report screens, and full delivery grouping/filter/history UI.
- [~] Backend still needs broader coverage for the remaining surfaces above plus stronger acceptance tests for inventory concurrency, pickup lifecycle, cancellation inventory restoration, review uniqueness, and report/export variants.
- [~] Native Expo application currently covers customer Home/Orders and API-backed seller, delivery, and admin preview actions; it does not yet mirror all customer, seller, delivery, and admin web screens.
- [ ] Production release work remains: device QA, final app assets/signing, hosted API/database, monitoring, and Play Store/App Store submission.

## 2026-09-19 checkpoint

- [x] Added responsive seller delivery-team management UI backed by `GET/POST /api/v1/seller/delivery-boys`.
- [x] Seller reports now support server-side apartment/block/flat, delivery-boy, product/category, status, fulfillment, and date filters, with PDF summary export.
- [x] Seller web reports now expose date, apartment, status, and fulfillment filters plus authenticated PDF download.
- [x] Verified web production build (`npm run build`).
- [x] Verified backend TypeScript build (`npm run api:build`).
- [x] Verified 11 database-backed HTTP/core tests (`npm test`).
- [x] Integration coverage verifies seller delivery assignment for a ready order and eligible delivery staff.
- [x] Integration coverage verifies a customer can submit and retrieve an advertisement request.
- [x] Integration coverage verifies Global Admin advertisement approval and audit-backed publication flow.
- [x] Integration coverage verifies protected Global Admin seller monitoring.
- [x] Verified PostgreSQL migration status is up to date (`npm run db:status`).
- [x] Verified Expo Android export (`npx expo export --platform android --output-dir dist-preview --no-minify`).
- [x] Mobile role preview now performs protected seller queue transitions, delivery status transitions, and Global Admin seller-visibility updates.
- [x] Expanded deterministic seed data to six named sellers across local and outside scopes, with shared delivery coverage and 50+ catalog products for role testing.
- [x] Seller storefront API and customer UI now expose active categories, approved seller-specific advertisements, and live category-filtered products.
- [x] Added integration assertions for storefront category, advertisement, and product payloads; the full 11-test database-backed suite remains green.
- [x] Final verification sweep passed: web build, backend build, PostgreSQL migration status, database-backed tests, and Expo Android export.
- [x] Fixed the native customer home screen to import its memoized seller filter and hide the Local/Outside selector when Global Admin enforces a single seller mode.
- [x] Rebuilt the native Android export from the `mobile` workspace after the mobile mode-control fix; Metro bundling completed successfully.
- [x] Documented every seeded test login: two Global Admins, one customer, six seller owners, and one delivery boy, with seeded apartments, products, inventory, advertisements, assignments, and orders.
- [x] Added apartment-scoped global search for visible sellers, products, and categories, connected to the customer Home search field and covered by integration tests.
- [x] Added seller rating summary/review APIs with completed-order and duplicate-review enforcement; the storefront now loads the live rating summary data.
- [x] Added seller profile/delivery/pickup/operating-settings APIs and responsive seller settings UI.
- [x] Added protected Global Admin user activation/role management, filtered order monitoring, and responsive user/order management panels with audit-backed user updates.
- [x] Order cancellation now restores tracked inventory in the same transaction and records inventory movement, status history, and audit data; Global Admin has controlled status override access.
- [x] Customer checkout now supports Delivery versus Takeaway/Pickup selection, with backend seller capability enforcement and no delivery address requirement for pickup orders.
- [x] Delivery queue API now supports scoped apartment/seller/status filters and configurable grouping by apartment, seller, or status.
- [x] Reworked the active customer storefront interaction: product quantities use minus/count/plus controls, cart summary exposes a direct Go to cart action, and cart state is shared across storefront navigation.
- [x] Customer navigation now preserves the access token in local storage, opens Profile from the top account chip, exposes Orders through bottom navigation, shows apartment/block/flat details, keeps seller registration and advertisement requests, and provides explicit logout from Profile.
- [x] Customer cart is now restricted to one seller at a time; adding from another seller shows a confirmation toast, and confirmation clears the old cart before adding the new item.
- [x] Customer storefront now keeps Go to cart as a bottom action bar only, while Profile provides an editable apartment/block/flat registration form backed by `POST /api/v1/apartments/me`.
- [x] Re-ran the idempotent database seed and verified dummy role data: 46 users, 4 apartments, 3 blocks, 6 flats, 6 sellers, 1 delivery profile, 107 products, 14 categories, 13 orders, and 38 apartment associations currently exist in PostgreSQL.
- [x] Reset PostgreSQL data while preserving the Prisma table structure, reapplied the initial migration, and reseeded the clean database: 10 users, 4 apartments, 3 blocks, 4 flats, 6 sellers, 1 delivery profile, 68 products, 14 categories, and 10 orders.
- [x] Added browser-session validation after database resets so stale access tokens are removed and users return to phone login instead of seeing an invalid community setup state.
- [x] Cleared all PostgreSQL records without seed data for real-time testing; customer Home no longer falls back to local dummy sellers or advertisements when the API returns an empty database.
- [x] Authentication now bootstraps required role records after a clean database reset, creates normal mobile logins as `CUSTOMER`, and reserves `9493499405` for Global Admin OTP login.
- [x] Added the separate `/admin` portal with Global Admin OTP login plus apartment creation, block/flat management, user role assignment, seller monitoring, alerts, orders, and dashboard controls.
- [x] Replaced the admin preview screen with a live API-backed tabbed workspace: Overview, Customers, Apartments (including nested blocks/flats), Sellers, Orders, and Settings now load and update PostgreSQL data instead of rendering hardcoded preview rows.
- [x] Simplified active admin apartment UI to apartment/block management; customer onboarding and Profile now always provide a flat-number field, using a predefined flat selector only when configured.
- [x] Admin apartment rows now visibly render child blocks beneath each parent apartment, with flat-creation controls removed; blockless apartments continue directly to manual flat entry during customer registration.
- [x] Reworked Global Admin apartment management into an expandable parent/child tree: apartment rows expand to vertical block rows, block names can be edited, and blocks can be activated/deactivated without exposing flat counts or flat-creation controls.
- [x] Added role-driven seller login: assigning an apartment/outside seller role prepares a seller profile, and the next mobile OTP login opens the live Seller Portal with store settings, delivery-area selection, product creation/availability, inventory, and order actions.
- [x] Verified customer visibility end to end for `9000000010`: restored Global Admin home visibility to `BOTH`; the customer Home now returns `Shop one` and its 3 available products for the matching apartment.
- [ ] Add a dedicated lint configuration/script; the repository currently has no `lint` npm script.

## Known technical follow-ups

## 2026-09-23 checkpoint

- Restored the built-in HTML/CSS splash screen after removing the external SVG splash experiment.
- Refined splash branding: Local Products wording, centered marketplace caption, and GatedCart text on the shopping bag.
- OTP entry now shows dashes instead of a row of zeros before input.
- Web production build passes with `npm run build`.
- The next device-validation artifact is an Android preview APK from the Expo/EAS mobile wrapper. Physical-device testing requires the web/API URLs to be reachable from the phone over the local network.

- Prisma's development dependency tree reports four high npm audit advisories in the current Prisma CLI toolchain; resolve through a reviewed Prisma upgrade rather than applying `npm audit fix --force` blindly.
- 2026-09-19: Improved order workflows. Seller orders now load complete customer delivery context, line items, totals and printable PDFs; status changes use clear action buttons instead of a native dropdown. Customer order tracking now exposes address, items, payment, timeline, cancellation and print actions. Removed the customer-facing “Become a seller” section from Profile.
- 2026-09-19: Unified responsive dashboard navigation. Seller/admin navigation remains visible on tablet widths and becomes a labeled bottom navigation bar on phones instead of an empty/collapsed sidebar. Customer profile no longer exposes seller-only promotion/application actions.
- 2026-09-19: Refined order presentation. Customer print action removed; customer tracking now differentiates completed and current stages. Seller invoice opens as a printable PDF tab and uses a structured invoice layout with customer/address, item columns, totals and notes.
- 2026-09-19: Rebuilt the customer Profile page shell with a back button, account heading, responsive spacing, and working Home/Orders/Profile bottom navigation.
- 2026-09-19: Changed customer community details to read-only by default. Apartment/block/flat editing is now opened explicitly through the pencil-style Edit details action and closes after a successful save.
- 2026-09-19: Added customer account identity to Profile with live name/phone data from `/auth/me` and a visible Log out action.
- 2026-09-19: Added authenticated customer name update API (`PATCH /api/v1/profile`) and Profile edit-name form with persisted PostgreSQL updates.
- 2026-09-19: Fixed live customer name usage on Home and Profile surfaces and refined the Profile name-edit layout for narrow mobile widths.
- 2026-09-19: Adjusted dashboard responsive navigation so seller/admin menus are collapsed by default below 900px and open through the top Menu toggle, including the 579px mobile/tablet viewport.
- 2026-09-19: Restored seller compact order workspace and corrected mobile navigation targets. The bottom bar now exposes only valid compact destinations, while the full menu opens as a half-width, full-height left drawer and closes on selection or outside tap.
- 2026-09-19: Added complete seller navigation routing: bottom main menu now includes Orders, Overview, Products and Settings; the side drawer also includes Delivery Areas and Inventory. Seller order cards retain expand/collapse, status actions and printable invoice access.
- 2026-09-19: Tightened the mobile seller drawer spacing while keeping the full-height half-width panel. Drawer navigation is now compact and top-aligned instead of spreading items across the entire panel.
- 2026-09-19: Rebuilt the customer login screen as a responsive marketplace entry page with GatedCart positioning, local-shopping benefits, community delivery messaging, marketplace showcase cards, and the existing mobile OTP flow.
- 2026-09-19: Preserved the previous login design as `LoginScreenV1` and activated a separate V2 login direction with a cleaner editorial marketplace layout, mobile-number OTP card, marketplace value messaging, and responsive mobile styling.
- 2026-09-19: Refined the active Login V1 palette with a darker purple hero and a harmonized indigo Continue button; the alternate login direction remains preserved for comparison.
- 2026-09-19: Added role-based post-login routing for the main marketplace login; users with `GLOBAL_ADMIN` now open the live Admin Workspace directly, while seller roles continue to open Seller Workspace.
- 2026-09-19: Replaced deprecated React Native `SafeAreaView` with `react-native-safe-area-context` and added `SafeAreaProvider` to the Expo root layout; Android export completed successfully.
- 2026-09-19: Reworked the mobile customer shell navigation with working Home, Orders, Profile and logout/back flows, plus a persistent bottom navigation bar; Android export verified after the change.
- 2026-09-20: Replaced the divergent native Expo customer shell with a WebView wrapper around the same web application; Android and iOS now use the exact website login, routes, navigation, seller workflows, checkout, orders, profile, seller, delivery, and admin screens. Added device-accessible web/API URL documentation; Android export and web build verified.
