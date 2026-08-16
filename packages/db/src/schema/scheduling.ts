import {
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { tstzrange } from "../custom-types";
import { reservationKindEnum, routeStatusEnum, slotHoldStatusEnum } from "./enums";
import { appointments, appointmentTechnicians } from "./jobs";
import { serviceTypes } from "./services";
import { scheduleBlocks, technicianProfiles, technicianTimeOff } from "./team";

/**
 * Short-lived reservation while a customer completes booking confirmation.
 * Owns a scheduleReservations row, so a hold and a booking can never collide.
 * The worker expires stale holds.
 */
export const slotHolds = pgTable("slot_holds", {
  id: uuid("id").primaryKey().defaultRandom(),
  technicianId: uuid("technician_id")
    .notNull()
    .references(() => technicianProfiles.id),
  timeRange: tstzrange("time_range").notNull(),
  serviceTypeId: uuid("service_type_id").references(() => serviceTypes.id),
  /** Anonymous booking-session key — not customer PII. */
  sessionKey: text("session_key").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  status: slotHoldStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * The single source of truth for technician time consumption. An EXCLUDE
 * USING gist constraint (added in the migration — Drizzle cannot express it)
 * makes overlapping reservations for one technician impossible at the
 * database level, while different technicians can always work in parallel.
 * Never weaken this constraint to make application code or tests pass.
 */
export const scheduleReservations = pgTable(
  "schedule_reservations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    technicianId: uuid("technician_id")
      .notNull()
      .references(() => technicianProfiles.id),
    timeRange: tstzrange("time_range").notNull(),
    kind: reservationKindEnum("kind").notNull(),
    appointmentTechnicianId: uuid("appointment_technician_id")
      .unique()
      .references(() => appointmentTechnicians.id, { onDelete: "cascade" }),
    slotHoldId: uuid("slot_hold_id")
      .unique()
      .references(() => slotHolds.id, { onDelete: "cascade" }),
    timeOffId: uuid("time_off_id").references(() => technicianTimeOff.id, {
      onDelete: "cascade",
    }),
    blockId: uuid("block_id").references(() => scheduleBlocks.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("schedule_reservations_technician_idx").on(t.technicianId)],
);

export const dailyRoutes = pgTable(
  "daily_routes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    technicianId: uuid("technician_id")
      .notNull()
      .references(() => technicianProfiles.id),
    routeDate: date("route_date").notNull(),
    status: routeStatusEnum("status").notNull().default("draft"),
    totalTravelMinutes: integer("total_travel_minutes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("daily_routes_tech_date_uq").on(t.technicianId, t.routeDate)],
);

export const routeStops = pgTable(
  "route_stops",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    routeId: uuid("route_id")
      .notNull()
      .references(() => dailyRoutes.id, { onDelete: "cascade" }),
    appointmentId: uuid("appointment_id")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    travelMinutesFromPrevious: integer("travel_minutes_from_previous"),
  },
  (t) => [unique("route_stops_route_seq_uq").on(t.routeId, t.sequence)],
);
