import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import {
  auditActorTypeEnum,
  notificationChannelEnum,
  notificationStatusEnum,
} from "./enums";

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  channel: notificationChannelEnum("channel").notNull(),
  template: text("template").notNull(),
  recipient: text("recipient").notNull(),
  payload: jsonb("payload"),
  status: notificationStatusEnum("status").notNull().default("pending"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
});

/**
 * Append-only record of operationally important actions (reassignments,
 * schedule overrides, cancellations, settings changes). No customer PII
 * beyond entity references.
 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorType: auditActorTypeEnum("actor_type").notNull(),
    actorId: text("actor_id"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    oldValue: jsonb("old_value"),
    newValue: jsonb("new_value"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_logs_entity_idx").on(t.entityType, t.entityId)],
);

/**
 * Scheduler decision log: why each candidate was recommended or rejected,
 * with per-component score breakdowns, so recommendations are explainable
 * and debuggable.
 */
export const schedulerDecisions = pgTable("scheduler_decisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  context: text("context").notNull(),
  serviceRequestId: uuid("service_request_id"),
  appointmentId: uuid("appointment_id"),
  candidates: jsonb("candidates").notNull(),
  selected: jsonb("selected"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
