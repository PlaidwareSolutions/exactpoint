import {
  boolean,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { geometryMultiPolygon } from "../custom-types";

/**
 * Configurable Greater Houston service zones. Managed by the owner under
 * Settings → Service Zones — never hard-coded in application logic.
 */
export const serviceZones = pgTable("service_zones", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  color: text("color"),
  isActive: boolean("is_active").notNull().default(true),
  priority: integer("priority").notNull().default(0),
  /** 0 = Sunday … 6 = Saturday */
  preferredDays: smallint("preferred_days").array(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** ZIP-based classification fallback; lat/lng + polygons stay canonical. */
export const serviceZoneZips = pgTable("service_zone_zips", {
  id: uuid("id").primaryKey().defaultRandom(),
  zoneId: uuid("zone_id")
    .notNull()
    .references(() => serviceZones.id, { onDelete: "cascade" }),
  zip: text("zip").notNull().unique(),
});

export const serviceZonePolygons = pgTable("service_zone_polygons", {
  id: uuid("id").primaryKey().defaultRandom(),
  zoneId: uuid("zone_id")
    .notNull()
    .references(() => serviceZones.id, { onDelete: "cascade" }),
  label: text("label"),
  geom: geometryMultiPolygon("geom").notNull(),
});
