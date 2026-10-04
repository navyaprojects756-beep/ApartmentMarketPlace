ALTER TABLE "orders"
ADD COLUMN "verification_code" VARCHAR(6),
ADD COLUMN "verified_at" TIMESTAMP(3);

UPDATE "orders" AS orders
SET "verification_code" = (
  SELECT items."verification_code"
  FROM "order_items" AS items
  WHERE items."order_id" = orders."id"
  ORDER BY items."id"
  LIMIT 1
)
WHERE "verification_code" IS NULL;

ALTER TABLE "orders"
ALTER COLUMN "verification_code" SET NOT NULL;

ALTER TABLE "order_items"
DROP COLUMN "verification_code",
DROP COLUMN "verified_at";
