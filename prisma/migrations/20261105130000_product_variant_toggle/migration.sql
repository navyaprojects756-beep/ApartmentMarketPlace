ALTER TABLE "products" ADD COLUMN "has_variants" BOOLEAN NOT NULL DEFAULT false;

UPDATE "products" AS product
SET "has_variants" = true
WHERE EXISTS (
  SELECT 1 FROM "product_variants" AS variant
  WHERE variant."product_id" = product."id"
);
