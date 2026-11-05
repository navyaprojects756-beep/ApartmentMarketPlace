CREATE TABLE "product_variants" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "option_name" VARCHAR(40) NOT NULL DEFAULT 'Option',
    "option_value" VARCHAR(80) NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "final_price" DECIMAL(12,2) NOT NULL,
    "unit" VARCHAR(40),
    "inventory_tracking" BOOLEAN NOT NULL DEFAULT false,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "low_stock_level" INTEGER NOT NULL DEFAULT 0,
    "minimum_quantity" INTEGER NOT NULL DEFAULT 1,
    "maximum_quantity" INTEGER,
    "availability" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "cart_items" ADD COLUMN "variant_id" UUID;
ALTER TABLE "order_items" ADD COLUMN "variant_id" UUID;
ALTER TABLE "order_items" ADD COLUMN "variant_label" VARCHAR(140);

CREATE UNIQUE INDEX "product_variants_product_id_option_name_option_value_key" ON "product_variants"("product_id", "option_name", "option_value");
CREATE INDEX "product_variants_product_id_availability_sort_order_idx" ON "product_variants"("product_id", "availability", "sort_order");
CREATE INDEX "cart_items_variant_id_idx" ON "cart_items"("variant_id");
CREATE INDEX "order_items_variant_id_idx" ON "order_items"("variant_id");
CREATE UNIQUE INDEX "cart_items_cart_id_product_id_variant_id_key" ON "cart_items"("cart_id", "product_id", "variant_id");

ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
