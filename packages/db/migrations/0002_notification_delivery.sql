ALTER TABLE "notifications" ADD COLUMN "entity_type" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "entity_id" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "provider_message_id" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "delivery_status" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "delivery_detail" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "delivery_updated_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "notifications_entity_idx" ON "notifications" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "notifications_provider_message_idx" ON "notifications" USING btree ("provider_message_id");