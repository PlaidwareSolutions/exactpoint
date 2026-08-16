import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { geometryPoint } from "../custom-types";
import { addressValidationStatusEnum, zoneAssignmentSourceEnum } from "./enums";
import { serviceTypes } from "./services";
import { serviceZones } from "./zones";

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    phone: text("phone"),
    email: text("email"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("customers_phone_idx").on(t.phone), index("customers_email_idx").on(t.email)],
);

export const customerAddresses = pgTable("customer_addresses", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  label: text("label"),
  /** Raw customer input, kept for troubleshooting validation issues. */
  enteredAddress: jsonb("entered_address"),
  street: text("street").notNull(),
  unit: text("unit"),
  city: text("city").notNull(),
  state: text("state").notNull().default("TX"),
  zip: text("zip").notNull(),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  /** Canonical geographic representation; lat/lng columns are conveniences. */
  geom: geometryPoint("geom"),
  validationStatus: addressValidationStatusEnum("validation_status")
    .notNull()
    .default("unvalidated"),
  zoneId: uuid("zone_id").references(() => serviceZones.id),
  zoneSource: zoneAssignmentSourceEnum("zone_source"),
  isPrimary: boolean("is_primary").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Reusable per-customer equipment records; appointments link back here. */
export const equipment = pgTable("equipment", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  serviceTypeId: uuid("service_type_id").references(() => serviceTypes.id),
  brand: text("brand"),
  model: text("model"),
  serial: text("serial"),
  approxAgeYears: integer("approx_age_years"),
  locationInHome: text("location_in_home"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
