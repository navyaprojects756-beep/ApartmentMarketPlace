CREATE TABLE "global_categories" (
  "id" UUID NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "image_url" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "global_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "global_categories_name_key" ON "global_categories"("name");
CREATE INDEX "global_categories_is_active_sort_order_idx" ON "global_categories"("is_active", "sort_order");

ALTER TABLE "products" ADD COLUMN "global_category_id" UUID;
CREATE INDEX "products_global_category_id_idx" ON "products"("global_category_id");
ALTER TABLE "products" ADD CONSTRAINT "products_global_category_id_fkey" FOREIGN KEY ("global_category_id") REFERENCES "global_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
