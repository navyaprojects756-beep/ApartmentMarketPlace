ALTER TABLE "global_categories" ADD COLUMN "parent_id" UUID;

CREATE INDEX "global_categories_parent_id_is_active_sort_order_idx" ON "global_categories"("parent_id", "is_active", "sort_order");

ALTER TABLE "global_categories" ADD CONSTRAINT "global_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "global_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
