# Seller workflow

## Seller request and approval

1. A customer opens Profile and chooses the seller registration option.
2. The applicant selects the seller type, enters the business details, and submits the request.
3. A pending request shows an application-status screen while Global Admin reviews it.
4. After approval, the Seller option becomes available and opens the Seller workspace. Rejected or suspended applications do not receive seller access.

## Store setup

From Seller workspace → Settings, configure:

- Business name, description, and outside-seller business address.
- One main shop/banner image. Use exactly **1200 × 500 px (12:5)** so it fits Home and the store page without gaps or distortion.
- Delivery or Takeaway mode.
- Delivery hours, active days, and accepting-orders status.
- Public rating visibility, when ratings are enabled for the seller.

## Products and images

From Seller workspace → Products, add the product name and price, then optionally set category, discount, pack size, description, instructions, minimum quantity, and maximum quantity. Upload product images using the same **1200 × 900 px (4:3)** format for consistent product cards and details pages.

## Inventory

Inventory tracking is optional. When enabled, enter available units and a low-stock alert level. The available quantity is reduced during checkout for tracked products. Orders cannot exceed the available stock, and the seller can adjust stock from the product controls. Products without tracking remain available without an automatic quantity limit.

## Orders

Seller orders appear in Seller workspace → Orders. Move an order through the available lifecycle, prepare the items, and use the delivery or takeaway flow shown for that order. Delivery orders require delivery coordination; takeaway orders are handed over to the customer according to the configured store mode.

## Availability and categories

The store is visible to customers only when it is approved and available for the apartment. Operating hours, active days, open status, delivery areas, product availability, and category availability are evaluated before customer display. Categories without available products are shown as disabled on Home.

Seller Orders supports Today, Yesterday, and custom From/To date filters together with status filtering. Global Admin has equivalent date filters for the Customers and Orders management panels.

## Image upload rules - 2026-11-05

- Selecting an image opens the crop editor before upload.
- Product images export as `1200 × 900 px` (4:3) and display fully inside a 4:3 frame.
- The main shop image/banner exports as `1200 × 500 px` (12:5) without top/bottom gaps.
- The editor adapts to mobile width, prevents out-of-bounds dragging, and compresses output below 1.5 MB.
- Product uploads are additive; replacing image 1 requires deleting the old image and uploading the replacement.

## Product variants - 2026-11-05

Sellers can enable variants and define a shared option name plus distinct values, such as `Size: Small` and `Size: Large`. Review each option's price, discount, unit, minimum/maximum quantity, availability, and inventory tracking independently.

- A tracked zero-quantity variant is sold out; an untracked variant does not require a quantity balance.
- Deactivate old options instead of removing the history needed by existing orders.
- Duplicated products start unavailable and with zero stock, including their copied variant structure.
- Re-adding a deactivated option reuses and activates the existing option record, so sellers do not receive a database uniqueness error. An option that is already active must be edited or deactivated first.
- Verify the customer picker, separate cart lines, checkout totals, and variant label in order history after catalog changes.

## Home seller descriptions - 2026-11-05

Seller descriptions on Home wrap across lines within the existing card size. When the text is longer than the reserved description area, it can be scrolled inside that area without showing a scrollbar. This does not change seller-card dimensions or seller data requirements.
