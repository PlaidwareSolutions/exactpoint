import {
  integer,
  jsonb,
  pgTable,
  text,
  time,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Singleton (id = 1, enforced by a CHECK in the migration). Owner-editable. */
export const businessSettings = pgTable("business_settings", {
  id: integer("id").primaryKey(),
  legalName: text("legal_name").notNull(),
  displayName: text("display_name").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  timezone: text("timezone").notNull().default("America/Chicago"),
  /** { "0": null, "1": {"open":"07:00","close":"19:00"}, … } — 0 = Sunday. */
  hours: jsonb("hours").notNull(),
  diagnosticFeeCents: integer("diagnostic_fee_cents").notNull(),
  laborWarrantyMonths: integer("labor_warranty_months").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by").references(() => users.id),
});

/** Singleton (id = 1). Scheduler weights live here, never in code. */
export const schedulingSettings = pgTable("scheduling_settings", {
  id: integer("id").primaryKey(),
  bookingHorizonDays: integer("booking_horizon_days").notNull().default(14),
  slotGranularityMinutes: integer("slot_granularity_minutes").notNull().default(30),
  bufferMinutes: integer("buffer_minutes").notNull().default(15),
  sameDayCutoff: time("same_day_cutoff").notNull().default("15:00"),
  holdMinutes: integer("hold_minutes").notNull().default(5),
  /** Soft-preference scoring weights, owner-tunable and explainable. */
  weights: jsonb("weights").notNull(),
  emergencyConfig: jsonb("emergency_config"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by").references(() => users.id),
});
