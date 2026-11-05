ALTER TABLE "products" ADD COLUMN "variant_name" VARCHAR(40);

UPDATE "products" AS product
SET "variant_name" = COALESCE((
  SELECT variant."option_name"
  FROM "product_variants" AS variant
  WHERE variant."product_id" = product."id"
  ORDER BY variant."sort_order" ASC, variant."created_at" ASC
  LIMIT 1
), 'Size / quantity')
WHERE product."has_variants" = true;
