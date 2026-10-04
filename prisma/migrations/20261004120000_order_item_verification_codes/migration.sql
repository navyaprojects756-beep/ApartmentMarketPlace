ALTER TABLE "order_items"
ADD COLUMN "verification_code" VARCHAR(6) NOT NULL DEFAULT '000000',
ADD COLUMN "verified_at" TIMESTAMP(3);

UPDATE "order_items"
SET "verification_code" = LPAD((FLOOR(RANDOM() * 1000000))::INT::TEXT, 6, '0');

ALTER TABLE "order_items"
ALTER COLUMN "verification_code" DROP DEFAULT;
