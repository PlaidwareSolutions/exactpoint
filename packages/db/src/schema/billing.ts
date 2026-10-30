import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  ESTIMATE_REVISION_KINDS,
  ESTIMATE_REVISION_STATUSES,
  ESTIMATE_STATUSES,
  INVOICE_STATUSES,
  LINE_ITEM_KINDS,
  PAYMENT_KINDS,
  PAYMENT_METHODS,
} from "@exactpoint/domain";
import { users } from "./auth";
import { workOrders } from "./jobs";

export const estimateStatusEnum = pgEnum("estimate_status", ESTIMATE_STATUSES);
export const estimateRevisionStatusEnum = pgEnum(
  "estimate_revision_status",
  ESTIMATE_REVISION_STATUSES,
);
export const estimateRevisionKindEnum = pgEnum("estimate_revision_kind", ESTIMATE_REVISION_KINDS);
export const lineItemKindEnum = pgEnum("line_item_kind", LINE_ITEM_KINDS);
export const invoiceStatusEnum = pgEnum("invoice_status", INVOICE_STATUSES);
export const paymentMethodEnum = pgEnum("payment_method", PAYMENT_METHODS);
export const paymentKindEnum = pgEnum("payment_kind", PAYMENT_KINDS);

/**
 * Repair quote (spec §85) — the stable handle for a work order's pricing.
 * The numbers live on revisions: every save is a new revision, so what the
 * customer was quoted earlier is never overwritten. `status` is the
 * decision state of the job's quote; a pending change order after approval
 * shows up as a `presented` current revision on an `approved` estimate.
 */
export const estimates = pgTable("estimates", {
  id: uuid("id").primaryKey().defaultRandom(),
  workOrderId: uuid("work_order_id")
    .notNull()
    .references(() => workOrders.id),
  status: estimateStatusEnum("status").notNull().default("draft"),
  /** The revision being shown / edited right now. */
  currentRevisionId: uuid("current_revision_id"),
  /** The revision the customer approved (what the invoice is built from). */
  approvedRevisionId: uuid("approved_revision_id"),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  createdBy: text("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** One snapshot of a quote: items, tax, fee policy, notes. Locked once decided. */
export const estimateRevisions = pgTable(
  "estimate_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    estimateId: uuid("estimate_id")
      .notNull()
      .references(() => estimates.id, { onDelete: "cascade" }),
    revision: integer("revision").notNull(),
    kind: estimateRevisionKindEnum("kind").notNull().default("quote"),
    status: estimateRevisionStatusEnum("status").notNull().default("presented"),
    /** Snapshot of the fee policy at quote time. */
    diagnosticFeeCents: integer("diagnostic_fee_cents").notNull(),
    taxRateBps: integer("tax_rate_bps").notNull().default(825),
    notes: text("notes"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdBy: text("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("estimate_revisions_estimate_revision_idx").on(t.estimateId, t.revision),
    check("estimate_revisions_revision_positive", sql`${t.revision} >= 1`),
  ],
);

export const estimateItems = pgTable(
  "estimate_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    revisionId: uuid("revision_id")
      .notNull()
      .references(() => estimateRevisions.id, { onDelete: "cascade" }),
    kind: lineItemKindEnum("kind").notNull().default("labor"),
    description: text("description").notNull(),
    quantity: integer("quantity").notNull().default(1),
    unitPriceCents: integer("unit_price_cents").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("estimate_items_revision_idx").on(t.revisionId)],
);

/**
 * Spec §86 — no card processing (§87); Zelle/cash/check only for now.
 * Payment state is derived from `invoice_payments`: status, paid-to-date
 * and balance are recomputed inside the same transaction as every ledger
 * write. `paidAt` is the moment the balance first reached zero.
 */
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
  /** The approved revision these totals were built from (changes with an approved change order). */
  estimateRevisionId: uuid("estimate_revision_id").references(() => estimateRevisions.id),
  status: invoiceStatusEnum("status").notNull().default("unpaid"),
  subtotalCents: integer("subtotal_cents").notNull(),
  diagnosticFeeCents: integer("diagnostic_fee_cents").notNull().default(0),
  taxCents: integer("tax_cents").notNull().default(0),
  totalCents: integer("total_cents").notNull(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Append-only payments ledger (spec §42). Every row is a receipt: payments
 * get RCT-#### numbers, refunds too (a refund receipt). Nothing here is ever
 * updated or deleted — corrections are new rows.
 */
export const invoicePayments = pgTable(
  "invoice_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id),
    kind: paymentKindEnum("kind").notNull().default("payment"),
    amountCents: integer("amount_cents").notNull(),
    method: paymentMethodEnum("method").notNull(),
    /** Check number, Zelle confirmation, etc. */
    reference: text("reference"),
    note: text("note"),
    receiptNumber: text("receipt_number")
      .notNull()
      .unique()
      .default(sql`'RCT-' || nextval('receipt_number_seq')`),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    recordedBy: text("recorded_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("invoice_payments_invoice_idx").on(t.invoiceId),
    check("invoice_payments_amount_positive", sql`${t.amountCents} > 0`),
  ],
);
