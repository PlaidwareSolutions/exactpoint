import {
  boolean,
  date,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { tstzrange } from "../custom-types";
import { users } from "./auth";
import { timeOffTypeEnum } from "./enums";
import { skills } from "./services";
import { serviceZones } from "./zones";

/**
 * Technicians are profiles, optionally linked to a login user once the
 * invitation is accepted. Deactivate, never delete — historical assignments
 * must survive.
 */
export const technicianProfiles = pgTable("technician_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .unique()
    .references(() => users.id),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  mobile: text("mobile"),
  email: text("email"),
  title: text("title"),
  isActive: boolean("is_active").notNull().default(true),
  startDate: date("start_date"),
  /** Calendar lane color, hex. */
  color: text("color"),
  maxDailyJobs: integer("max_daily_jobs"),
  emergencyAvailable: boolean("emergency_available").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const technicianSkills = pgTable(
  "technician_skills",
  {
    technicianId: uuid("technician_id")
      .notNull()
      .references(() => technicianProfiles.id, { onDelete: "cascade" }),
    skillId: uuid("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.technicianId, t.skillId] })],
);

export const technicianZonePreferences = pgTable(
  "technician_zone_preferences",
  {
    technicianId: uuid("technician_id")
      .notNull()
      .references(() => technicianProfiles.id, { onDelete: "cascade" }),
    zoneId: uuid("zone_id")
      .notNull()
      .references(() => serviceZones.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.technicianId, t.zoneId] })],
);

/** Weekly working-hours template; multiple windows per day allowed. */
export const technicianAvailability = pgTable("technician_availability", {
  id: uuid("id").primaryKey().defaultRandom(),
  technicianId: uuid("technician_id")
    .notNull()
    .references(() => technicianProfiles.id, { onDelete: "cascade" }),
  /** 0 = Sunday … 6 = Saturday */
  dayOfWeek: smallint("day_of_week").notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
});

export const technicianTimeOff = pgTable("technician_time_off", {
  id: uuid("id").primaryKey().defaultRandom(),
  technicianId: uuid("technician_id")
    .notNull()
    .references(() => technicianProfiles.id, { onDelete: "cascade" }),
  period: tstzrange("period").notNull(),
  type: timeOffTypeEnum("type").notNull(),
  note: text("note"),
  createdBy: text("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Operational blocks; technicianId NULL blocks the whole company. */
export const scheduleBlocks = pgTable("schedule_blocks", {
  id: uuid("id").primaryKey().defaultRandom(),
  technicianId: uuid("technician_id").references(() => technicianProfiles.id, {
    onDelete: "cascade",
  }),
  period: tstzrange("period").notNull(),
  reason: text("reason"),
  createdBy: text("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
