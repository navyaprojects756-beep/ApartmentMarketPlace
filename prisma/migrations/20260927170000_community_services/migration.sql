CREATE TABLE "community_services" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "image_url" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "community_services_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "community_services_name_key" ON "community_services"("name");
CREATE INDEX "community_services_is_active_sort_order_idx" ON "community_services"("is_active", "sort_order");

CREATE TABLE "community_service_providers" (
    "id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "phone" VARCHAR(30) NOT NULL,
    "address" TEXT NOT NULL,
    "image_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "community_service_providers_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "community_service_providers_service_id_is_active_idx" ON "community_service_providers"("service_id", "is_active");
ALTER TABLE "community_service_providers" ADD CONSTRAINT "community_service_providers_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "community_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "community_service_apartments" (
    "provider_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "apartment_id" UUID NOT NULL,
    CONSTRAINT "community_service_apartments_pkey" PRIMARY KEY ("provider_id", "apartment_id")
);
CREATE INDEX "community_service_apartments_apartment_id_idx" ON "community_service_apartments"("apartment_id");
CREATE INDEX "community_service_apartments_service_id_apartment_id_idx" ON "community_service_apartments"("service_id", "apartment_id");
ALTER TABLE "community_service_apartments" ADD CONSTRAINT "community_service_apartments_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "community_service_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_service_apartments" ADD CONSTRAINT "community_service_apartments_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "community_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "community_service_apartments" ADD CONSTRAINT "community_service_apartments_apartment_id_fkey" FOREIGN KEY ("apartment_id") REFERENCES "apartments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
