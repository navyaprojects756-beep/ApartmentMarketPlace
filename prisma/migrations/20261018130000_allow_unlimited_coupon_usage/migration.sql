ALTER TABLE "coupons"
    ALTER COLUMN "max_uses_per_customer" DROP NOT NULL,
    ALTER COLUMN "max_uses_per_customer" DROP DEFAULT;
