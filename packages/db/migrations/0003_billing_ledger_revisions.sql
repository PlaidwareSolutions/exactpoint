CREATE TYPE "public"."estimate_revision_kind" AS ENUM('quote', 'change_order');--> statement-breakpoint
CREATE TYPE "public"."estimate_revision_status" AS ENUM('presented', 'superseded', 'approved', 'declined');--> statement-breakpoint
CREATE TYPE "public"."payment_kind" AS ENUM('payment', 'refund');--> statement-breakpoint
ALTER TYPE "public"."invoice_status" ADD VALUE 'partially_paid' BEFORE 'paid';--> statement-breakpoint
CREATE SEQUENCE "public"."receipt_number_seq" START WITH 1001;--> statement-breakpoint
CREATE TABLE "estimate_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"estimate_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"kind" "estimate_revision_kind" DEFAULT 'quote' NOT NULL,
	"status" "estimate_revision_status" DEFAULT 'presented' NOT NULL,
	"diagnostic_fee_cents" integer NOT NULL,
	"tax_rate_bps" integer DEFAULT 825 NOT NULL,
	"notes" text,
	"decided_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "estimate_revisions_revision_positive" CHECK ("estimate_revisions"."revision" >= 1)
);
--> statement-breakpoint
CREATE TABLE "invoice_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"kind" "payment_kind" DEFAULT 'payment' NOT NULL,
	"amount_cents" integer NOT NULL,
	"method" "payment_method" NOT NULL,
	"reference" text,
	"note" text,
	"receipt_number" text DEFAULT 'RCT-' || nextval('receipt_number_seq') NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"recorded_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_payments_receipt_number_unique" UNIQUE("receipt_number"),
	CONSTRAINT "invoice_payments_amount_positive" CHECK ("invoice_payments"."amount_cents" > 0)
);
--> statement-breakpoint
ALTER TABLE "estimate_revisions" ADD CONSTRAINT "estimate_revisions_estimate_id_estimates_id_fk" FOREIGN KEY ("estimate_id") REFERENCES "public"."estimates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_revisions" ADD CONSTRAINT "estimate_revisions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "estimate_revisions_estimate_revision_idx" ON "estimate_revisions" USING btree ("estimate_id","revision");--> statement-breakpoint
CREATE INDEX "invoice_payments_invoice_idx" ON "invoice_payments" USING btree ("invoice_id");--> statement-breakpoint
-- Backfill: every existing estimate becomes revision 1 (its decision state carries over).
INSERT INTO "estimate_revisions" ("estimate_id", "revision", "kind", "status", "diagnostic_fee_cents", "tax_rate_bps", "notes", "decided_at", "created_by", "created_at")
SELECT "id", 1, 'quote',
	(CASE "status"::text WHEN 'approved' THEN 'approved' WHEN 'declined' THEN 'declined' ELSE 'presented' END)::"estimate_revision_status",
	"diagnostic_fee_cents", "tax_rate_bps", "notes", "decided_at", "created_by", "created_at"
FROM "estimates";--> statement-breakpoint
ALTER TABLE "estimates" ADD COLUMN "current_revision_id" uuid;--> statement-breakpoint
ALTER TABLE "estimates" ADD COLUMN "approved_revision_id" uuid;--> statement-breakpoint
UPDATE "estimates" e SET "current_revision_id" = r."id",
	"approved_revision_id" = CASE WHEN e."status" = 'approved' THEN r."id" END
FROM "estimate_revisions" r WHERE r."estimate_id" = e."id" AND r."revision" = 1;--> statement-breakpoint
ALTER TABLE "estimate_items" DROP CONSTRAINT "estimate_items_estimate_id_estimates_id_fk";
--> statement-breakpoint
ALTER TABLE "estimate_items" ADD COLUMN "revision_id" uuid;--> statement-breakpoint
UPDATE "estimate_items" i SET "revision_id" = r."id"
FROM "estimate_revisions" r WHERE r."estimate_id" = i."estimate_id" AND r."revision" = 1;--> statement-breakpoint
ALTER TABLE "estimate_items" ALTER COLUMN "revision_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "estimate_items" ADD CONSTRAINT "estimate_items_revision_id_estimate_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."estimate_revisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "estimate_items_revision_idx" ON "estimate_items" USING btree ("revision_id");--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "estimate_revision_id" uuid;--> statement-breakpoint
UPDATE "invoices" inv SET "estimate_revision_id" = r."id"
FROM "estimate_revisions" r WHERE r."estimate_id" = inv."estimate_id" AND r."revision" = 1;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_estimate_revision_id_estimate_revisions_id_fk" FOREIGN KEY ("estimate_revision_id") REFERENCES "public"."estimate_revisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Backfill: invoices already marked paid get one ledger row for the full amount.
INSERT INTO "invoice_payments" ("invoice_id", "kind", "amount_cents", "method", "note", "received_at", "created_at")
SELECT "id", 'payment', "total_cents", "payment_method", 'Recorded before the payments ledger existed',
	COALESCE("paid_at", "updated_at"), COALESCE("paid_at", "updated_at")
FROM "invoices" WHERE "status" = 'paid' AND "payment_method" IS NOT NULL AND "total_cents" > 0;--> statement-breakpoint
ALTER TABLE "estimate_items" DROP COLUMN "estimate_id";--> statement-breakpoint
ALTER TABLE "estimates" DROP COLUMN "diagnostic_fee_cents";--> statement-breakpoint
ALTER TABLE "estimates" DROP COLUMN "tax_rate_bps";--> statement-breakpoint
ALTER TABLE "estimates" DROP COLUMN "notes";--> statement-breakpoint
ALTER TABLE "invoices" DROP COLUMN "payment_method";
