import { sql } from "drizzle-orm";
import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import {
  ESTIMATE_STATUSES,
  INVOICE_STATUSES,
  LINE_ITEM_KINDS,
  PAYMENT_METHODS,
} from "@exactpoint/domain";
import { users } from "./auth";
import { workOrders } from "./jobs";

export const estimateStatusEnum = pgEnum("estimate_status", ESTIMATE_STATUSES);
export const lineItemKindEnum = pgEnum("line_item_kind", LINE_ITEM_KINDS);
export const invoiceStatusEnum = pgEnum("invoice_status", INVOICE_STATUSES);
export const paymentMethodEnum = pgEnum("payment_method", PAYMENT_METHODS);

/**
 * Repair quote (spec §85). Amounts live on items; totals are computed with
 * the pure helpers in @exactpoint/domain so the waiver rule has one home.
 */
export const estimates = pgTable("estimates", {
  id: uuid("id").primaryKey().defaultRandom(),
  workOrderId: uuid("work_order_id")
    .notNull()
    .references(() => workOrders.id),
  status: estimateStatusEnum("status").notNull().default("draft"),
  /** Snapshot of the fee policy at estimate time. */
  diagnosticFeeCents: integer("diagnostic_fee_cents").notNull(),
  taxRateBps: integer("tax_rate_bps").notNull().default(825),
  notes: text("notes"),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  createdBy: text("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const estimateItems = pgTable("estimate_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  estimateId: uuid("estimate_id")
    .notNull()
    .references(() => estimates.id, { onDelete: "cascade" }),
  kind: lineItemKindEnum("kind").notNull().default("labor"),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPriceCents: integer("unit_price_cents").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

/** Spec §86 — no card processing (§87); Zelle/cash/check only for now. */
export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  number: text("number")
    .notNull()
    .unique()
    .default(sql`'INV-' || nextval('invoice_number_seq')`),
  workOrderId: uuid("work_order_id")
    .notNull()
    .references(() => workOrders.id),
  estimateId: uuid("estimate_id").references(() => estimates.id),
  status: invoiceStatusEnum("status").notNull().default("unpaid"),
  subtotalCents: integer("subtotal_cents").notNull(),
  diagnosticFeeCents: integer("diagnostic_fee_cents").notNull().default(0),
  taxCents: integer("tax_cents").notNull().default(0),
  totalCents: integer("total_cents").notNull(),
  paymentMethod: paymentMethodEnum("payment_method"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
