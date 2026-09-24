# Apartment Marketplace --- Full Project Generation Specification

## 1. Project Goal

Build a complete apartment/community marketplace platform with:

-   Android app
-   iOS app
-   Responsive Web app
-   Seller dashboard
-   Delivery-boy dashboard
-   Global admin dashboard
-   Shared backend and PostgreSQL database

Initial development/testing must run entirely on local servers.

### Recommended stack

-   Frontend: React Native + Expo + Expo Router + React Native Web
-   Backend: Node.js + Express + TypeScript
-   Database: PostgreSQL
-   ORM: Prisma
-   API: REST
-   Authentication: phone number + dummy OTP initially
-   File/image storage: local filesystem initially
-   PDF generation: server-side PDF generation
-   State management: Zustand or equivalent
-   Validation: Zod
-   API docs: Swagger/OpenAPI
-   Development: Visual Studio Code

Use one frontend codebase for Android, iOS and Web as much as practical.

Business rules must be enforced in the backend, not only in UI.

Do not use WhatsApp as a dependency for marketplace functionality.

------------------------------------------------------------------------

# 2. Core Business Concept

This is a private/local marketplace for apartment communities.

After login, a customer sees three major areas:

1.  Advertisements
2.  Apartment/community sellers
3.  Outside/local sellers

Apartment sellers can sell only inside their own community.

Outside sellers can serve multiple selected apartments.

Customers can browse sellers, browse category-wise products, add
products to cart, place orders, track orders and view order history.

Sellers get complete store, inventory, order, delivery, reporting and
advertisement management.

Delivery boys can work for multiple sellers and deliver orders for
multiple sellers within permitted apartments.

Global admins can manage the complete platform.

------------------------------------------------------------------------

# 3. User Roles

Implement role-based access control.

Roles:

-   CUSTOMER
-   APARTMENT_SELLER
-   OUTSIDE_SELLER
-   DELIVERY_BOY
-   GLOBAL_ADMIN

Support multiple GLOBAL_ADMIN users.

Design authorization so it can later support more granular permissions.

Every protected API must verify authorization on the backend.

------------------------------------------------------------------------

# 4. Authentication

Initial implementation uses dummy OTP.

Flow:

1.  User enters phone number.
2.  Backend creates/login session.
3.  OTP is always the last 5 digits of the phone number.
4.  User enters OTP.
5.  Backend validates OTP.
6.  JWT/access token is issued.

Example:

Phone: `9876543210` OTP: `43210`

Create an abstraction:

-   OtpService
-   DummyOtpProvider

so a real SMS provider can be added later without rewriting
authentication.

Requirements:

-   Phone login
-   Registration by phone
-   Logout
-   Token refresh
-   Current-user endpoint
-   Role detection
-   Session expiry
-   Basic rate limiting
-   Authentication audit logging

------------------------------------------------------------------------

# 5. Apartment Structure

The apartment hierarchy must be flexible.

## Case A --- Apartment + Blocks + Flats

Apartment - Block A - A101 - A102 - Block B - B101 - B102

## Case B --- Apartment + Flats without blocks

Apartment - Flat 101 - Flat 102

## Case C --- Apartment only

No predefined blocks/flats.

During registration, the user can enter their flat number manually.

Global admin can configure:

-   Apartment name
-   Address
-   City
-   State
-   Pincode
-   Whether blocks exist
-   Whether flats are predefined

Blocks and flats are optional.

------------------------------------------------------------------------

# 6. Global Admin Apartment Management

Global admins can:

-   Add apartment
-   Edit apartment
-   Activate/deactivate apartment
-   Add blocks
-   Edit blocks
-   Add flats
-   Edit flats
-   Delete/deactivate blocks/flats when safe
-   Bulk import blocks/flats
-   Search/filter apartments
-   View residents
-   View sellers
-   View delivery activity

Do not require blocks or predefined flats for every apartment.

------------------------------------------------------------------------

# 7. Customer Registration / Community Selection

After login, the customer selects or confirms:

-   Apartment
-   Block if applicable
-   Flat if predefined
-   Manual flat number if apartment has no predefined flats

Store the community association.

Design for future apartment changes without destroying historical order
information.

------------------------------------------------------------------------

# 8. Home Page

The home page contains:

## A. Advertisements

Show approved advertisements.

Advertisement types:

-   Promotion
-   Seller advertisement
-   User advertisement
-   Product promotion
-   Apartment announcement
-   Event
-   Important alert

Ads can target:

-   All apartments
-   Specific apartments
-   Specific seller
-   Specific category

## B. Apartment Sellers

Show sellers belonging to the user's current apartment.

## C. Outside Sellers

Show outside sellers that have selected the user's apartment as a
delivery area.

## D. Global Admin Seller Display Configuration

Global admins can control which seller type is displayed to customers on
the home page for the platform:

-   `LOCAL_ONLY`: show only apartment/community sellers belonging to the
    user's current apartment.
-   `OUTSIDE_ONLY`: show only outside sellers whose delivery areas include
    the user's current apartment.
-   `BOTH`: show both seller types.

The initial/default value is `BOTH` so existing marketplace visibility is
preserved until a global admin changes it.

In this setting, “local sellers” means apartment/community sellers, while
“outside sellers” means sellers serving the apartment through configured
delivery areas. The setting must be configurable from the Global Admin
Settings screen and must be enforced by the backend.

Home-page behavior:

-   When `BOTH` is enabled, display two separate tiles/sections: “Local
    Sellers” and “Outside Sellers”. Each tile opens its corresponding
    seller list.
-   When `LOCAL_ONLY` or `OUTSIDE_ONLY` is enabled, display the enabled
    seller list directly rather than showing two tiles.
-   If the selected seller type has no eligible sellers, show its normal
    empty state and do not expose sellers from the disabled type.

The backend home response should include the active display mode and only
the seller collections permitted by that mode. The frontend must render
the home page from this response and must not implement the restriction by
filtering an unrestricted seller list.

Backend visibility rule:

-   Local sellers: `user apartment -> seller apartment relationship ->
    matching apartment seller`
-   Outside sellers: `user apartment -> seller delivery areas -> matching
    outside seller`

Do not rely on frontend filtering.

------------------------------------------------------------------------

# 9. Global Important Alerts

Global admins can create important alerts.

Fields:

-   Title
-   Description
-   Image
-   Optional action/button
-   Start date/time
-   End date/time
-   Target apartments
-   Priority
-   Active/inactive

Important alerts can appear as a prominent popup/modal on app launch.

Examples:

-   Water interruption
-   Emergency notice
-   Important apartment announcement
-   Festival announcement
-   Critical service announcement

Support per-user read/dismiss state.

Future-ready fields:

-   paid promotion flag
-   payment status
-   advertiser
-   campaign ID

Do not implement advertising payment yet.

------------------------------------------------------------------------

# 10. Advertisement Request System

Normal users and sellers can request advertisements.

Flow:

Requester -\> Create advertisement request -\> PENDING -\> Global Admin
reviews -\> APPROVE / REJECT -\> Scheduled advertisement becomes active

Fields:

-   Requester
-   Seller if applicable
-   Title
-   Description
-   Image/banner
-   Advertisement type
-   Target apartments
-   Start date
-   End date
-   Priority
-   Status
-   Admin remarks
-   Approved/rejected by
-   Approved/rejected timestamp

Statuses:

-   DRAFT
-   PENDING
-   APPROVED
-   REJECTED
-   EXPIRED
-   CANCELLED

Admin can preview before approval.

------------------------------------------------------------------------

# 11. Seller Registration

Customer can select:

`Become a Seller`

Options:

## Apartment Seller

-   Automatically tied to user's apartment
-   Can sell only inside that apartment
-   Cannot select other communities

## Outside Seller

-   Business/store information
-   Can select multiple apartments
-   Requires admin approval
-   Can modify delivery areas later subject to approval

Seller information:

-   Seller name
-   Business/store name
-   Phone
-   Email optional
-   Description
-   Logo
-   Banner
-   Address
-   Seller type
-   Apartment relationship
-   Delivery areas
-   Operating hours
-   Open/closed status
-   Delivery/pickup options
-   Minimum order amount optional
-   Delivery charge configuration

------------------------------------------------------------------------

# 12. Seller Storefront

Each seller has a storefront.

Display:

-   Logo
-   Banner
-   Store name
-   Description
-   Rating
-   Operating status
-   Operating hours
-   Delivery information
-   Pickup availability
-   Small seller-specific advertisement area
-   Categories
-   Products

The seller-specific ad area should be independently manageable.

------------------------------------------------------------------------

# 13. Categories

Seller can create and manage categories.

Examples:

-   Grocery
-   Dairy
-   Food
-   Bakery
-   Fashion
-   Electronics
-   Beauty
-   Services
-   Household
-   Other

Features:

-   Create
-   Edit
-   Activate/deactivate
-   Sort order
-   Image/icon optional

Prefer soft deletion/deactivation where historical data exists.

------------------------------------------------------------------------

# 14. Product Management

Seller can:

-   Add product
-   Edit product
-   Duplicate product
-   Activate/deactivate
-   Delete when safe
-   Upload multiple images
-   Set category
-   Set price
-   Set discount
-   Set final price
-   Set SKU optional
-   Set unit
-   Set description
-   Set availability
-   Enable/disable inventory tracking
-   Set quantity
-   Set low-stock threshold
-   Set minimum order quantity
-   Set maximum order quantity
-   Set preparation time
-   Set delivery/pickup eligibility

Product fields:

-   ID
-   Seller ID
-   Category ID
-   Name
-   Description
-   Images
-   SKU
-   Price
-   Discount
-   Final price
-   Unit
-   Inventory tracking enabled
-   Quantity
-   Low-stock threshold
-   Availability
-   Minimum quantity
-   Maximum quantity
-   Preparation time
-   Created/updated timestamps

------------------------------------------------------------------------

# 15. Inventory Management

Inventory management is mandatory.

## Inventory tracking OFF

Example:

Homemade Biryani Inventory tracking: OFF

Seller manually controls availability.

## Inventory tracking ON

Example:

Milk packets Initial quantity: 100

Successful orders decrease quantity:

100 -\> 95 -\> 75 -\> 0

At zero:

`OUT_OF_STOCK`

Do not allow ordering above available stock.

Use database transactions/locking to prevent overselling during
simultaneous orders.

Support:

-   Stock increase
-   Stock decrease
-   Manual adjustment
-   Stock history
-   Low-stock alert
-   Out-of-stock status
-   Inventory movement history
-   Product availability toggle

Inventory movement types:

-   INITIAL_STOCK
-   SALE
-   MANUAL_ADD
-   MANUAL_REMOVE
-   RETURN
-   CANCELLED_ORDER
-   ADJUSTMENT

Maintain a complete audit trail.

------------------------------------------------------------------------

# 16. Cart

Prefer one cart per seller.

If products from multiple sellers are selected, maintain separate seller
carts or split into separate seller orders at checkout.

Never create one mixed-seller operational order.

Validate inventory again during checkout.

------------------------------------------------------------------------

# 17. Checkout

Checkout contains:

-   Seller
-   Products
-   Quantities
-   Subtotal
-   Discount
-   Delivery charge
-   Total
-   Delivery/pickup option
-   Delivery address
-   Apartment
-   Block
-   Flat
-   Customer notes
-   Payment method

Initial payment methods:

-   Cash on delivery
-   Dummy payment

Real payment gateway will be added later.

------------------------------------------------------------------------

# 18. Order Management

Build a complete, auditable order management system.

Order fields:

-   Order number
-   Customer
-   Seller
-   Apartment
-   Block
-   Flat
-   Address
-   Items
-   Subtotal
-   Discount
-   Delivery charge
-   Total
-   Payment status
-   Fulfillment type
-   Current status
-   Delivery boy
-   Customer notes
-   Seller notes
-   Created timestamp
-   Accepted timestamp
-   Preparing timestamp
-   Ready timestamp
-   Pickup timestamp
-   Delivered timestamp
-   Cancelled timestamp

Maintain complete status history.

Never destroy order history.

------------------------------------------------------------------------

# 19. Delivery Order Workflow

Default delivery workflow:

PENDING -\> ACCEPTED -\> PREPARING -\> READY_FOR_PICKUP -\>
ASSIGNED_TO_DELIVERY_BOY -\> PICKED_UP -\> OUT_FOR_DELIVERY -\>
DELIVERED

Allow cancellation/rejection according to business rules.

------------------------------------------------------------------------

# 20. Takeaway/Pickup Workflow

Takeaway workflow:

PENDING -\> ACCEPTED -\> PREPARING -\> READY_FOR_PICKUP -\> PICKED_UP
-\> COMPLETED

Customer must see the correct workflow based on fulfillment type.

------------------------------------------------------------------------

# 21. Order Status Rules

Only valid status transitions are allowed.

Example:

PENDING -\> ACCEPTED ACCEPTED -\> PREPARING PREPARING -\>
READY_FOR_PICKUP READY_FOR_PICKUP -\> ASSIGNED_TO_DELIVERY_BOY
ASSIGNED_TO_DELIVERY_BOY -\> PICKED_UP PICKED_UP -\> OUT_FOR_DELIVERY
OUT_FOR_DELIVERY -\> DELIVERED

Do not allow random status changes.

Admin can have controlled override functionality, with audit logging.

------------------------------------------------------------------------

# 22. Customer Order Tracking

Customer can see:

-   Order number
-   Seller
-   Items
-   Amount
-   Delivery/pickup type
-   Current status
-   Status timeline
-   Delivery boy information when appropriate
-   Address
-   Estimated delivery time if configured
-   Order history

Example:

Order Placed ✓ Accepted ✓ Preparing ✓ Ready ● Out for Delivery ○
Delivered

Takeaway:

Order Placed ✓ Accepted ✓ Preparing ● Ready for Pickup ○ Picked Up

------------------------------------------------------------------------

# 23. Seller Order Dashboard

Seller dashboard must be comprehensive.

Dashboard cards:

-   Today's orders
-   Pending orders
-   Accepted
-   Preparing
-   Ready
-   Out for delivery
-   Delivered
-   Cancelled
-   Today's sales
-   Pending amount
-   Low-stock products

Order filters:

-   Status
-   Date
-   Customer
-   Apartment
-   Block
-   Flat
-   Delivery boy
-   Fulfillment type
-   Payment status
-   Order number

Order search must be fast.

------------------------------------------------------------------------

# 24. Seller Order Actions

Seller can:

-   Accept
-   Reject
-   Start preparing
-   Mark ready
-   Assign delivery boy
-   Mark picked up when applicable
-   Cancel according to rules
-   Add seller notes
-   Print order
-   Reprint order
-   View customer details
-   View order history
-   View status history

------------------------------------------------------------------------

# 25. Order Printing

Each order must have a print-friendly format.

Seller can click:

`Print Order`

Print format should include:

-   Seller/store name
-   Order number
-   Date/time
-   Customer name
-   Apartment
-   Block
-   Flat
-   Phone
-   Items
-   Quantity
-   Price
-   Total
-   Delivery/pickup
-   Notes
-   Barcode/QR code optional
-   Order status

Design it to print on A4 and small thermal/printer-friendly formats
where possible.

Example:

  --------------------------------
  ORDER #10234 Sri Lakshmi Foods
  19 Sep 2026 12:40 PM

  Customer: Ram ABC Residency
  Block B - Flat 502 Phone:
  XXXXXXXX

  1 x Biryani ₹180 2 x Curd ₹120

  Total ₹300

  DELIVERY
  --------------------------------

The seller can print and attach the paper to the delivery box.

------------------------------------------------------------------------

# 26. Delivery Boy System

A delivery boy is an independent user entity.

A delivery boy can work for multiple sellers.

Example:

Delivery Boy Ramesh - Seller A - Seller B - Seller C

Do NOT create duplicate delivery-boy users for each seller.

Phone number should identify the delivery-boy account.

------------------------------------------------------------------------

# 27. Delivery Boy Registration by Seller

Seller can add a delivery boy:

-   Name
-   Phone number
-   Optional profile photo
-   Active/inactive
-   Apartments served

The seller can assign that delivery boy to the seller.

If the delivery boy already exists, link the existing account instead of
creating a duplicate.

------------------------------------------------------------------------

# 28. Delivery Boy Apartment Scope

Maintain delivery-boy apartment relationships.

A delivery boy may serve:

-   ABC Residency
-   My Home
-   Aparna

Orders shown to the delivery boy must respect:

1.  Seller assignment
2.  Apartment assignment
3.  Order fulfillment type
4.  Delivery status

------------------------------------------------------------------------

# 29. Delivery Boy Login

Phone + dummy OTP.

After login:

Backend identifies:

-   DELIVERY_BOY role
-   Assigned sellers
-   Assigned apartments
-   Eligible orders

Dashboard:

-   Today's deliveries
-   Pending pickup
-   Picked up
-   Out for delivery
-   Delivered
-   Apartment filters
-   Seller filters

------------------------------------------------------------------------

# 30. Delivery Boy Order Grouping

A delivery boy may receive orders from multiple sellers.

Group orders by:

1.  Apartment
2.  Block
3.  Seller
4.  Status

Example:

ABC Residency

Block A - Flat A101 --- Seller A --- Order 1001 - Flat A204 --- Seller B
--- Order 1008

Block B - Flat B102 --- Seller A --- Order 1005 - Flat B305 --- Seller C
--- Order 1015

Also provide seller grouping:

Seller A - Order 1001 - Order 1005

Seller B - Order 1008

Seller C - Order 1015

This should be configurable in the UI.

------------------------------------------------------------------------

# 31. Delivery Boy Actions

Delivery boy can:

-   View assigned orders
-   Accept delivery assignment if required
-   Mark picked up
-   Mark out for delivery
-   Mark delivered
-   Add delivery note
-   Call customer using device phone capability
-   View apartment/block/flat
-   View delivery sequence
-   Filter by seller/apartment/status

Proof of delivery can be future-ready:

-   OTP
-   Photo
-   Signature

Do not require it in initial MVP.

------------------------------------------------------------------------

# 32. Seller Delivery Assignment

When order is ready:

Seller can assign an eligible delivery boy.

Show only delivery boys who:

-   Are active
-   Are linked to the seller
-   Serve the order's apartment

Example:

Ramesh ✓ Seller linked ✓ Apartment served

Suresh ✓ Seller linked ✗ Apartment not served

Backend must enforce this too.

------------------------------------------------------------------------

# 33. Reports

Sellers need extensive reporting.

Reports must support date filters.

Filters:

-   Today
-   Yesterday
-   This week
-   This month
-   Custom date range

Additional filters:

-   Apartment
-   Block
-   Flat
-   Seller
-   Product
-   Category
-   Delivery boy
-   Order status
-   Payment status
-   Fulfillment type

------------------------------------------------------------------------

# 34. Seller Sales Reports

Show:

-   Total orders
-   Completed orders
-   Cancelled orders
-   Gross sales
-   Discounts
-   Delivery charges
-   Net sales
-   Average order value
-   Units sold
-   Top products
-   Low-stock products

Charts:

-   Daily sales
-   Weekly sales
-   Monthly sales
-   Orders by status
-   Sales by category

------------------------------------------------------------------------

# 35. Apartment-Wise Reports

Seller can select an apartment.

Example:

ABC Residency

Show:

-   Number of orders
-   Sales
-   Customers
-   Average order value
-   Top products

Support date range.

------------------------------------------------------------------------

# 36. Block-Wise Reports

For apartments with blocks:

ABC Residency -\> Block A -\> Block B -\> Block C

Report:

-   Orders
-   Sales
-   Customers
-   Products
-   Average order value

------------------------------------------------------------------------

# 37. Flat-Wise Reports

Seller can select a flat.

Example:

Block B -\> Flat 502

Show:

-   Order count
-   Total purchase
-   Last order
-   Products purchased

Do not expose sensitive customer data to sellers beyond what is
necessary for legitimate order/report functionality.

------------------------------------------------------------------------

# 38. Product Reports

Show:

-   Product sales
-   Quantity sold
-   Revenue
-   Returns/cancellations
-   Inventory movement
-   Current stock

Filters by date and apartment.

------------------------------------------------------------------------

# 39. Delivery Boy Reports

Seller can see:

-   Deliveries assigned
-   Delivered
-   Pending
-   Cancelled
-   Delivery completion rate
-   Date range
-   Apartment

------------------------------------------------------------------------

# 40. PDF Export

All major seller reports must support PDF export.

Examples:

-   Sales report
-   Apartment report
-   Block report
-   Flat report
-   Product report
-   Order report
-   Delivery report

PDF should contain:

-   Seller name
-   Report title
-   Date range
-   Applied filters
-   Generated timestamp
-   Summary
-   Table
-   Page numbers

Use server-side PDF generation.

For large reports, use streaming/pagination rather than loading
unlimited records into memory.

------------------------------------------------------------------------

# 41. CSV/Excel Export

Also support CSV export for major reports.

Optional later:

-   XLSX export

PDF is mandatory for V1 reporting.

------------------------------------------------------------------------

# 42. Order Export

Seller can export filtered orders.

Filters:

-   Date
-   Status
-   Apartment
-   Block
-   Flat
-   Delivery boy

Export formats:

-   PDF
-   CSV

------------------------------------------------------------------------

# 43. Global Admin Dashboard

Admin dashboard should contain:

-   Total users
-   Active users
-   Total sellers
-   Apartment sellers
-   Outside sellers
-   Delivery boys
-   Apartments
-   Orders today
-   Sales today
-   Pending orders
-   Advertisement requests
-   Active advertisements
-   Important alerts

Charts:

-   Orders over time
-   Sales over time
-   Sellers
-   Apartment activity
-   Top sellers
-   Top apartments

------------------------------------------------------------------------

# 44. Global Admin User Management

Admin can:

-   Search users
-   View users
-   Activate/deactivate users
-   Assign roles
-   Remove roles according to permissions
-   View seller status
-   View delivery-boy status
-   View apartment association

Multiple users can be GLOBAL_ADMIN.

Do not allow an admin to remove the final active global admin without a
safe workflow.

------------------------------------------------------------------------

# 45. Global Admin Seller Management

Admin can:

-   View seller applications
-   Approve/reject sellers
-   Activate/deactivate sellers
-   View seller products
-   View seller orders
-   View delivery boys
-   View delivery areas
-   View advertisements
-   Suspend sellers
-   Add admin remarks
-   Configure customer home-page seller display mode:
    `LOCAL_ONLY`, `OUTSIDE_ONLY`, or `BOTH`
-   View the currently active display mode and its audit history

Changing this setting must take effect for subsequent home-page API
responses and must be recorded in the audit log with the admin, previous
value, new value, and timestamp.

Seller approval status:

-   PENDING
-   APPROVED
-   REJECTED
-   SUSPENDED
-   INACTIVE

------------------------------------------------------------------------

# 46. Global Admin Order Monitoring

Admin can view all orders.

Filters:

-   Date
-   Apartment
-   Seller
-   Customer
-   Status
-   Delivery boy
-   Fulfillment
-   Payment

Admin can inspect full order history.

Admin overrides must be audited.

------------------------------------------------------------------------

# 47. Notifications

Implement notification architecture.

Notification types:

-   Order placed
-   Order accepted
-   Order rejected
-   Preparing
-   Ready
-   Delivery assigned
-   Picked up
-   Out for delivery
-   Delivered
-   Advertisement approved/rejected
-   Seller approved/rejected
-   Important alert
-   Low inventory
-   New seller request

Initial implementation can use in-app notifications.

Architecture should be ready for push notifications later.

------------------------------------------------------------------------

# 48. Search

Global search can search:

-   Sellers
-   Products
-   Categories

Seller search can search:

-   Orders
-   Customers
-   Apartments
-   Blocks
-   Flats

Use pagination.

------------------------------------------------------------------------

# 49. Reviews and Ratings

Customers can rate:

-   Seller
-   Product optionally

Rating:

1 to 5 stars

Allow review text.

Prevent multiple uncontrolled reviews for the same order/product.

Only eligible completed orders should be reviewable.

------------------------------------------------------------------------

# 50. Seller Operating Hours

Seller can define:

-   Open/close time
-   Days
-   Holiday/temporary closure
-   Delivery availability

If outside operating hours:

-   Show CLOSED
-   Prevent or optionally schedule orders

------------------------------------------------------------------------

# 51. Seller Delivery Configuration

Seller can configure:

-   Delivery enabled
-   Pickup enabled
-   Delivery fee
-   Free delivery threshold
-   Minimum order amount
-   Delivery radius is not required if apartment selection is used
-   Estimated delivery time

------------------------------------------------------------------------

# 52. Order Cancellation

Define cancellation rules.

Customer can cancel before a configurable stage.

Seller can reject/cancel with reason.

Admin can override.

Cancellation must create status history.

Inventory should be restored when appropriate.

Example:

Order accepted but cancelled before delivery -\> return ordered quantity
to inventory if business rule allows.

------------------------------------------------------------------------

# 53. Audit Logging

Track important actions:

-   Login
-   Role changes
-   Seller approval
-   Seller suspension
-   Product changes
-   Inventory adjustments
-   Order status changes
-   Admin changes
-   Advertisement approval/rejection
-   Important alert creation
-   Delivery assignment

Audit record:

-   User
-   Action
-   Entity
-   Entity ID
-   Old value if applicable
-   New value if applicable
-   Timestamp
-   IP/device metadata if practical

------------------------------------------------------------------------

# 54. Security Requirements

Implement:

-   Passwordless phone authentication
-   JWT access token
-   Refresh token strategy
-   Role-based authorization
-   Input validation
-   SQL injection protection through ORM
-   API rate limiting
-   CORS configuration
-   File upload validation
-   Image size limits
-   Secure error responses
-   Audit logging
-   Transactional order creation
-   Transactional inventory updates

Never trust client-provided seller/apartment/price values.

At order creation, backend must calculate authoritative prices from
database.

------------------------------------------------------------------------

# 55. Order Price Integrity

Never accept final totals blindly from frontend.

Backend must:

1.  Load product prices
2.  Validate products belong to seller
3.  Validate product availability
4.  Validate stock
5.  Calculate discounts
6.  Calculate delivery charge
7.  Calculate subtotal
8.  Calculate final total
9.  Create order transactionally
10. Decrease stock transactionally

------------------------------------------------------------------------

# 56. Database Design

Use normalized PostgreSQL schema.

Minimum major tables:

-   users
-   roles
-   user_roles
-   refresh_tokens
-   otp_requests
-   apartments
-   blocks
-   flats
-   user_apartments
-   seller_profiles
-   seller_delivery_areas
-   seller_categories
-   products
-   product_images
-   inventory
-   inventory_movements
-   delivery_boys
-   delivery_boy_sellers
-   delivery_boy_apartments
-   advertisements
-   advertisement_requests
-   notifications
-   notification_reads
-   carts
-   cart_items
-   orders
-   order_items
-   order_status_history
-   order_delivery_assignments
-   addresses
-   payments
-   reviews
-   audit_logs
-   platform_settings (including the customer home-page seller display
    mode)

Use UUID primary keys.

Use created_at/updated_at consistently.

Use soft delete/deactivation where historical relationships exist.

Add appropriate indexes for:

-   phone
-   apartment_id
-   seller_id
-   product_id
-   order_number
-   order status
-   order date
-   delivery boy
-   seller delivery area
-   advertisement status/date

------------------------------------------------------------------------

# 57. API Structure

Use REST APIs.

Example:

/api/auth/* /api/users/* /api/apartments/* /api/sellers/*
/api/categories/* /api/products/* /api/inventory/* /api/carts/*
/api/orders/* /api/delivery/* /api/advertisements/* /api/notifications/*
/api/reports/* /api/admin/*

Provide an admin settings endpoint for the home-page seller display mode,
for example `GET/PATCH /api/v1/admin/settings/home-seller-display-mode`.
The home-page endpoint must return the effective mode and only the
authorized local/outside seller lists for the authenticated user's
apartment.

Use versioning:

`/api/v1/...`

Generate Swagger/OpenAPI documentation.

------------------------------------------------------------------------

# 58. Frontend Applications

Use one codebase.

Recommended structure:

src/ app/ components/ features/ auth/ home/ apartments/ sellers/
products/ cart/ orders/ delivery/ advertisements/ reports/ admin/
services/ store/ hooks/ utils/ types/ config/

Use route groups for:

-   customer
-   seller
-   delivery
-   admin

Use reusable responsive components.

------------------------------------------------------------------------

# 59. Customer Screens

Minimum screens:

1.  Splash
2.  Login
3.  OTP
4.  Apartment selection
5.  Home
6.  Advertisement detail
7.  Apartment seller list
8.  Outside seller list
9.  Seller detail
10. Category
11. Product detail
12. Cart
13. Checkout
14. Order success
15. My orders
16. Order detail
17. Order tracking
18. Notifications
19. Profile
20. Address/community settings
21. Become a seller
22. Seller registration

------------------------------------------------------------------------

# 60. Seller Screens

1.  Seller dashboard
2.  Orders
3.  Order detail
4.  Products
5.  Add product
6.  Edit product
7.  Categories
8.  Inventory
9.  Inventory history
10. Delivery boys
11. Add delivery boy
12. Delivery assignments
13. Store profile
14. Delivery areas
15. Seller advertisements
16. Advertisement request
17. Reports
18. PDF export
19. CSV export
20. Settings

------------------------------------------------------------------------

# 61. Delivery Boy Screens

1.  Login
2.  Dashboard
3.  Assigned orders
4.  Order detail
5.  Apartment filter
6.  Seller filter
7.  Grouped deliveries
8.  Pickup
9.  Out for delivery
10. Delivered
11. Delivery history
12. Profile

------------------------------------------------------------------------

# 62. Global Admin Screens

1.  Admin dashboard
2.  Users
3.  User detail
4.  Roles/admin management
5.  Apartments
6.  Blocks
7.  Flats
8.  Sellers
9.  Seller approvals
10. Delivery boys
11. Products
12. Categories
13. Orders
14. Advertisements
15. Advertisement approvals
16. Important alerts
17. Notifications
18. Reports
19. Audit logs
20. Settings

------------------------------------------------------------------------

# 63. Dummy Data / Seed

The project must include a complete database seed script.

Run:

`npm run db:seed`

Seed realistic test data.

Create:

## Apartments

-   ABC Residency
-   My Home Residency
-   Green Valley Apartments
-   Sunrise Towers

Use different structures:

ABC Residency: - Blocks A/B/C - Multiple flats

My Home Residency: - No blocks - Multiple flats

Green Valley Apartments: - Apartment only - No predefined flats

Sunrise Towers: - Blocks and flats

## Users

Create dummy users with phone numbers.

Example:

-   9876543210
-   9876543211
-   9876543212
-   9876543213
-   9876543214
-   9876543215

Document the dummy login OTP rule.

## Roles

Create examples for:

-   Customer
-   Apartment seller
-   Outside seller
-   Delivery boy
-   Global admin

Create at least two global admins.

## Sellers

Create multiple sellers:

-   Home Foods
-   Fresh Milk
-   Sweet Home Bakery
-   Fashion Corner
-   Sri Lakshmi Supermarket
-   Fresh Vegetables
-   Outside Grocery Dealer

Some should be apartment sellers.

Some should be outside sellers.

Outside sellers must serve multiple apartments.

## Products

Seed at least 50 realistic products.

Include:

-   Grocery
-   Dairy
-   Food
-   Bakery
-   Fashion
-   Household
-   Other

Include products with inventory tracking ON and OFF.

Example:

Milk: quantity 100

Rice: quantity 50

Biryani: inventory tracking OFF

## Orders

Seed orders in all important states:

-   Pending
-   Accepted
-   Preparing
-   Ready for pickup
-   Assigned
-   Picked up
-   Out for delivery
-   Delivered
-   Cancelled

Create orders across:

-   Multiple apartments
-   Multiple blocks
-   Multiple flats
-   Multiple sellers
-   Multiple delivery boys

## Advertisements

Seed:

-   Promotional ads
-   Seller ads
-   Apartment announcements
-   Approved ads
-   Pending requests
-   Rejected requests
-   Expired ads

## Important Alerts

Seed 2--3 global alerts with images/placeholders.

------------------------------------------------------------------------

# 64. Local File Storage

For initial development:

-   Store uploaded images locally
-   Create an uploads directory
-   Serve files through backend
-   Validate MIME types
-   Limit file size
-   Generate safe filenames

Later storage can be replaced by:

-   Azure Blob
-   S3
-   Cloudinary
-   Other object storage

Do not tightly couple the application to local storage.

Create a storage abstraction.

------------------------------------------------------------------------

# 65. Local Development

Everything must run locally initially.

Suggested services:

Frontend: `http://localhost:3000` or Expo development server

Backend: `http://localhost:5000`

PostgreSQL: `localhost:5432`

Swagger: `http://localhost:5000/api-docs`

Provide:

-   `.env.example`
-   `.env.local.example`
-   database setup instructions
-   migration instructions
-   seed instructions
-   run commands

Example:

`npm install`

`npx prisma migrate dev`

`npm run db:seed`

`npm run dev`

------------------------------------------------------------------------

# 66. Docker Option

Provide an optional Docker Compose setup for:

-   PostgreSQL
-   Backend
-   Optional admin/web service

The project should still be runnable without Docker if PostgreSQL is
installed locally.

------------------------------------------------------------------------

# 67. Testing

Create tests for critical business rules.

Especially test:

-   Login
-   Authorization
-   Global admin home-page seller display mode changes
-   Local-only, outside-only, and both-mode home responses
-   Home response never exposes a disabled seller type
-   Apartment seller visibility
-   Outside seller delivery-area visibility
-   Inventory decrement
-   Inventory oversell prevention
-   Order creation
-   Order status transitions
-   Delivery-boy assignment
-   Delivery-boy seller scope
-   Delivery-boy apartment scope
-   Advertisement approval
-   Admin permissions

Create API integration tests for critical flows.

------------------------------------------------------------------------

# 68. Inventory Concurrency

This is mandatory.

Example:

Stock = 1

Customer A and Customer B order at nearly the same time.

Only one order can successfully reserve/decrease the final stock.

Use a PostgreSQL transaction with an appropriate row lock or atomic
update.

Never rely on:

`frontend reads stock -> frontend checks stock -> backend inserts order`

because this can oversell.

------------------------------------------------------------------------

# 69. Order Transaction

Order creation should be transactional:

1.  Validate customer
2.  Validate seller
3.  Validate products
4.  Lock inventory
5.  Validate stock
6.  Calculate authoritative prices
7.  Create order
8.  Create order items
9.  Decrease inventory
10. Create status history
11. Create notification
12. Commit

If anything fails, rollback the transaction.

------------------------------------------------------------------------

# 70. Reporting Architecture

Reports should use backend APIs and server-side aggregation.

Do not download all orders to the frontend and calculate huge reports in
JavaScript.

Support:

-   Pagination
-   Aggregation queries
-   Date filters
-   Apartment filters
-   Block filters
-   Flat filters
-   Seller filters
-   Product filters
-   Status filters

------------------------------------------------------------------------

# 71. PDF Report Design

PDF reports should be professional.

Header:

-   Platform name
-   Seller name
-   Report title
-   Date range

Summary cards:

-   Orders
-   Sales
-   Average order
-   Units sold

Table:

-   Date
-   Order
-   Customer
-   Apartment
-   Block
-   Flat
-   Amount
-   Status

Footer:

-   Generated at
-   Page number

------------------------------------------------------------------------

# 72. Responsive Web

Web must support:

-   Customer marketplace
-   Seller dashboard
-   Delivery dashboard
-   Admin dashboard

Desktop layouts should use tables and side navigation where appropriate.

Mobile web should remain responsive.

Do not simply stretch the mobile UI on desktop.

------------------------------------------------------------------------

# 73. App Update Strategy

The app should be architected so small UI/configuration changes can be
delivered remotely where appropriate.

Use:

-   Remote configuration for colors/content/feature flags
-   OTA-compatible React Native update strategy where appropriate
-   Version checking
-   Minimum supported app version

Do not attempt to remotely replace native functionality that requires a
new App Store/Play Store binary.

------------------------------------------------------------------------

# 74. Feature Flags

Create feature flags for future functionality.

Examples:

-   payments_enabled
-   reviews_enabled
-   delivery_tracking_enabled
 -   seller_ads_enabled
 -   global_alerts_enabled
 -   pickup_enabled
 -   inventory_enabled

The home-page seller display mode is a controlled business setting, not a
client-only feature flag. If feature flags are used around it, they must
not bypass the backend authorization and seller visibility rules.

Admin can later control feature availability if required.

------------------------------------------------------------------------

# 75. Business Rules Summary

### Apartment seller

Can sell only in their own apartment.

### Outside seller

Can sell only to apartments explicitly included in delivery areas.

### Customer

Can see:

-   global ads
-   ads targeted to their apartment
-   apartment sellers in their apartment when the global admin setting is
    `LOCAL_ONLY` or `BOTH`
-   outside sellers serving their apartment when the global admin setting
    is `OUTSIDE_ONLY` or `BOTH`

Home navigation must show two seller tiles only in `BOTH` mode. In either
single-type mode, it must open the permitted seller list directly.

### Delivery boy

Can see only:

-   orders belonging to assigned sellers
-   orders for permitted apartments
-   eligible delivery orders

### Global admin

Can manage everything.

------------------------------------------------------------------------

# 76. Important UX Principles

Keep customer experience simple.

Home should quickly expose:

1.  Ads
2.  The seller display configured by the global admin:
    -   two tiles, Local Sellers and Outside Sellers, when both are
        enabled
    -   one direct seller list when only one seller type is enabled

Seller UI should prioritize:

1.  Orders
2.  Inventory
3.  Products
4.  Delivery
5.  Reports

Delivery UI should prioritize:

1.  Today's deliveries
2.  Apartment grouping
3.  Pickup
4.  Out for delivery
5.  Delivered

Admin UI should prioritize:

1.  Approvals
2.  Orders
3.  Sellers
4.  Apartments
5.  Ads
6.  Reports

------------------------------------------------------------------------

# 77. Future-Ready Features

Architect but do not necessarily implement initially:

-   Real SMS OTP
-   Push notifications
-   UPI/payment gateway
-   Subscription/membership
-   Paid advertisements
-   Seller advertising packages
-   Coupons
-   Loyalty points
-   Delivery route optimization
-   Live delivery tracking
-   Customer support/chat
-   Refund management
-   GST invoices
-   Seller settlements
-   Commission management
-   Multi-language
-   Barcode scanning
-   QR-based delivery confirmation
-   Digital receipts
-   Seller analytics
-   Bulk product import
-   Bulk inventory update
-   Excel product import
-   Scheduled orders
-   Recurring orders
-   Favorites
-   Wishlist
-   Product variants
-   Multiple seller branches
-   Apartment-specific pricing
-   Apartment-wide offers
-   Group/bulk buying

Do not implement future features unless required for V1, but avoid
architecture choices that make them impossible.

------------------------------------------------------------------------

# 78. Development Rules for the AI Code Generator

Generate actual working code, not only mock screens.

Requirements:

1.  Start with the database schema.
2.  Generate Prisma schema and migrations.
3.  Generate seed data.
4.  Generate backend APIs.
5.  Generate authentication.
6.  Generate authorization.
7.  Generate frontend screens.
8.  Connect frontend to real APIs.
9.  Do not hardcode marketplace data into UI.
10. Use environment variables.
11. Use TypeScript.
12. Use reusable components.
13. Use proper error handling.
14. Use loading states.
15. Use empty states.
16. Use validation.
17. Use pagination.
18. Use database transactions.
19. Add API documentation.
20. Add tests for critical flows.

Never put secret keys in frontend code.

Never trust frontend-provided prices, seller IDs, apartment IDs, roles,
or inventory values.

------------------------------------------------------------------------

# 79. Required Initial Deliverable

Generate a complete monorepo.

Suggested structure:

apartment-marketplace/ apps/ mobile/ web/ admin/ services/ api/
packages/ shared/ types/ config/ prisma/ schema.prisma seed.ts docs/
architecture.md api.md database.md docker-compose.yml .env.example
README.md

If keeping a single React Native Web application for
customer/seller/admin is simpler, that is acceptable, provided routing
and role-based access are cleanly separated.

------------------------------------------------------------------------

# 80. Required README

README must explain:

-   Prerequisites
-   Node version
-   PostgreSQL setup
-   Environment variables
-   Database creation
-   Prisma migration
-   Seed data
-   Starting backend
-   Starting mobile
-   Starting web
-   Swagger
-   Dummy login credentials
-   Dummy OTP rule
-   How to generate PDF
-   How to print orders
-   How to run tests
-   How to build Android
-   How to build iOS later
-   How to run web

------------------------------------------------------------------------

# 81. Initial Dummy Accounts

Create clearly documented seed accounts.

Example:

GLOBAL_ADMIN: Phone: 9000000001 OTP: 00001

GLOBAL_ADMIN: Phone: 9000000002 OTP: 00002

CUSTOMER: Phone: 9000000010 OTP: 00010

APARTMENT_SELLER: Phone: 9000000020 OTP: 00020

OUTSIDE_SELLER: Phone: 9000000030 OTP: 00030

DELIVERY_BOY: Phone: 9000000040 OTP: 00040

Use the same last-five-digit OTP rule.

------------------------------------------------------------------------

# 82. Acceptance Criteria

The project is considered functionally complete for V1 only when:

1.  A user can login using dummy OTP.
2.  A user can select an apartment.
3.  Home displays ads.
4.  Global admin can set home seller display mode to local only,
    outside only, or both.
5.  In local-only mode, home opens a direct list containing only eligible
    apartment sellers.
6.  In outside-only mode, home opens a direct list containing only
    eligible outside sellers.
7.  In both mode, home displays separate Local Sellers and Outside Sellers
    tiles and each tile opens the correct list.
8.  Backend home APIs never return sellers from a disabled seller type.
9.  A user can open a seller.
10. Seller products are grouped by category.
11. Seller-specific ad appears at top of seller page.
12. Customer can add products to cart.
13. Customer can place an order.
14. Inventory decreases correctly.
15. Stock cannot be oversold.
16. Seller receives the order.
17. Seller can move order through valid statuses.
18. Customer sees status updates.
19. Seller can print an order.
20. Delivery boy can login.
21. Delivery boy can work for multiple sellers.
22. Delivery boy sees only eligible orders.
23. Delivery boy can update delivery status.
24. Seller can view reports.
25. Seller can filter reports by date/apartment/block/flat.
26. Seller can export reports to PDF.
27. Seller can export order/report data to CSV.
28. Seller can manage inventory.
29. Seller can add/edit products and categories.
30. Seller can add delivery boys.
31. Outside seller can select multiple apartments.
32. Apartment seller is restricted to own community.
33. User/seller can submit advertisement requests.
34. Global admin can approve/reject ads.
35. Global admin can create important image alerts.
36. Multiple global admins work correctly.
37. Global admin can manage apartments, blocks and flats.
38. Apartments without blocks are supported.
39. Apartments without predefined flats are supported.
40. Critical APIs enforce authorization.
41. Database seed creates realistic dummy data.
42. Entire system works on local servers.
43. Android, iOS and Web share the intended codebase.
44. README contains complete local setup instructions.
45. Critical business rules have automated tests.

------------------------------------------------------------------------

# 83. Implementation Order

Build in this order:

## Phase 1

-   Monorepo
-   PostgreSQL
-   Prisma schema
-   Migrations
-   Seed data
-   Backend foundation
-   Authentication
-   RBAC

## Phase 2

-   Apartment management
-   User/community association
-   Seller registration
-   Seller approval
-   Global admin home-page seller display configuration

## Phase 3

-   Seller/store/category/product
-   Inventory
-   Customer home
-   Home-page local/outside seller tiles or direct-list behavior
-   Seller browsing
-   Search

## Phase 4

-   Cart
-   Checkout
-   Orders
-   Inventory transaction logic
-   Status history

## Phase 5

-   Seller order dashboard
-   Printing
-   Delivery boys
-   Multi-seller delivery
-   Apartment grouping

## Phase 6

-   Advertisements
-   Advertisement approval
-   Global alerts

## Phase 7

-   Reports
-   PDF export
-   CSV export
-   Admin dashboard
-   Audit logs

## Phase 8

-   UI polish
-   Responsive Web
-   Android/iOS testing
-   Error handling
-   Performance
-   Security review

------------------------------------------------------------------------

# 84. Final Instruction to Code Generator

## Current repository checkpoint — 2026-09-24

The repository currently contains a working V1 web/API implementation plus an Expo WebView mobile shell. The active splash uses the built-in responsive HTML/CSS artwork, with Local Products wording, centered marketplace caption, and GatedCart bag branding. OTP fields use dash placeholders while retaining the documented dummy OTP validation. The database can be kept empty for fresh testing; seed data is optional and must be loaded deliberately. The hosted deployment uses Render for the frontend, API, and PostgreSQL database, with the web app at `https://gatedcart.cheritech.com` and the API at `https://gatedcart-api.onrender.com/api/v1`. The Expo/EAS preview APK has been built and tested against those hosted URLs.

Deployment details are maintained in `README.md`, `docs/release-checklist.md`, `docs/technical-architecture.md`, `docs/api.md`, and `mobile/README.md`. The Render API uses the internal PostgreSQL URL, while local pgAdmin uses the external PostgreSQL URL with SSL mode `require`. The deployed frontend receives `VITE_API_URL`; EAS receives `EXPO_PUBLIC_WEB_APP_URL` and `EXPO_PUBLIC_API_URL`. No database seed is run automatically during deployment.

Do not create a superficial demo.

Create a properly structured full-stack application with:

-   Real PostgreSQL persistence
-   Real REST APIs
-   Real authentication
-   Real authorization
-   Real seller/order/inventory relationships
-   Real order status history
-   Real delivery-boy assignment
-   Real report queries
-   Real PDF generation
-   Real print layouts
-   Seeded dummy data
-   Local development configuration

Use mock data only where explicitly requested for external services such
as OTP/payment/push notifications.

Keep the code modular and maintainable.

Every business rule described in this specification must be implemented
in the backend and reflected in the frontend.

Where a requirement is ambiguous, choose a sensible implementation that
preserves extensibility and document the decision in
`docs/architecture.md`.

Do not remove functionality merely to simplify the demo.
