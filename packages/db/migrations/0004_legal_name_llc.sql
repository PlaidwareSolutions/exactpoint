-- Owner-supplied 2026-11-04: registered LLC name (from his service agreement).
-- Data-only. business_settings is a singleton (id = 1) and organizations holds
-- the single tenant; the legal name is not owner-editable in the UI, so both
-- are set outright. On an empty database this touches no rows and the seed
-- inserts the new name from BUSINESS.legalName.
UPDATE "business_settings"
  SET "legal_name" = 'ExactPoint Appliance & HVAC Repair Services LLC', "updated_at" = now()
  WHERE "id" = 1 AND "legal_name" <> 'ExactPoint Appliance & HVAC Repair Services LLC';
--> statement-breakpoint
UPDATE "organizations"
  SET "name" = 'ExactPoint Appliance & HVAC Repair Services LLC'
  WHERE "name" <> 'ExactPoint Appliance & HVAC Repair Services LLC';
