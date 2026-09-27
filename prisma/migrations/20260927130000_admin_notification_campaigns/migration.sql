CREATE TABLE "notification_campaigns" (
    "id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "message" TEXT NOT NULL,
    "filters" JSONB,
    "route" VARCHAR(80),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notification_campaigns_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "notifications" ADD COLUMN "campaign_id" UUID;

CREATE INDEX "notification_campaigns_created_by_id_created_at_idx" ON "notification_campaigns"("created_by_id", "created_at");
CREATE INDEX "notifications_campaign_id_created_at_idx" ON "notifications"("campaign_id", "created_at");

ALTER TABLE "notification_campaigns" ADD CONSTRAINT "notification_campaigns_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "notification_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
