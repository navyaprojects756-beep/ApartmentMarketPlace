CREATE TABLE "error_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "request_id" VARCHAR(80),
    "severity" VARCHAR(20) NOT NULL DEFAULT 'ERROR',
    "source" VARCHAR(30) NOT NULL DEFAULT 'API',
    "code" VARCHAR(120),
    "message" TEXT NOT NULL,
    "details" JSONB,
    "method" VARCHAR(12),
    "route" VARCHAR(500),
    "status_code" INTEGER,
    "ip_address" VARCHAR(120),
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "error_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "error_logs_created_at_idx" ON "error_logs"("created_at");
CREATE INDEX "error_logs_severity_created_at_idx" ON "error_logs"("severity", "created_at");
CREATE INDEX "error_logs_source_created_at_idx" ON "error_logs"("source", "created_at");
CREATE INDEX "error_logs_user_id_created_at_idx" ON "error_logs"("user_id", "created_at");

ALTER TABLE "error_logs" ADD CONSTRAINT "error_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
