ALTER TABLE "apartments"
ADD COLUMN IF NOT EXISTS "seller_display_mode" "HomeSellerDisplayMode" NOT NULL DEFAULT 'BOTH';
