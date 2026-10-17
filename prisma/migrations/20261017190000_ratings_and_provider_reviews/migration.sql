ALTER TABLE "seller_profiles"
ADD COLUMN "show_ratings" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "service_provider_reviews" (
    "id" UUID NOT NULL,
    "provider_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "service_provider_reviews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "service_provider_reviews_provider_id_user_id_key" ON "service_provider_reviews"("provider_id", "user_id");
CREATE INDEX "service_provider_reviews_provider_id_created_at_idx" ON "service_provider_reviews"("provider_id", "created_at");
ALTER TABLE "service_provider_reviews" ADD CONSTRAINT "service_provider_reviews_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "community_service_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_provider_reviews" ADD CONSTRAINT "service_provider_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
