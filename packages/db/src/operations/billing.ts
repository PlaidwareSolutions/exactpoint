import { and, asc, desc, eq, inArray, max, sql, type SQL } from "drizzle-orm";
import {
  balanceCents,
  invoiceAmountsForDecision,
  invoiceStatusFor,
  paidCents as netPaidCents,
  subtotalCents,
  taxCents,
  type LineItemKind,
  type PaymentKind,
  type PaymentMethod,
} from "@exactpoint/domain";
import type { Database } from "../client";
import {
  auditLogs,
  estimateItems,
  estimateRevisions,
  estimates,
  invoicePayments,
  invoices,
  workOrders,
} from "../schema";
import { latestNotificationFor } from "./notifications";

export interface EstimateItemInput {
  kind: LineItemKind;
  description: string;
  quantity: number;
  unitPriceCents: number;
}

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/* ------------------------------------------------------------------ */
/* Quotes: every save is a new revision (spec §85)                     */
/* ------------------------------------------------------------------ */

/**
 * Saves the work order's quote as a new revision. Before the first
 * decision the revision replaces the one the customer is looking at (which
 * becomes "superseded"). After approval the new revision is a change order
 * that must be approved or declined on its own; the approved revision
 * stays locked and visible.
 */
export async function saveEstimateRevision(
  db: Database,
  input: {
    workOrderId: string;
    items: EstimateItemInput[];
    taxRateBps: number;
    diagnosticFeeCents: number;
    notes?: string;
    createdBy: string;
  },
): Promise<{ estimateId: string; revisionId: string; revision: number; kind: "quote" | "change_order" }> {
  if (input.items.length === 0) throw new Error("Add at least one line item.");
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(estimates)
      .where(eq(estimates.workOrderId, input.workOrderId))
      .for("update");

    let estimateId = existing?.id;
    let kind: "quote" | "change_order" = "quote";
    let revisionNumber = 1;
    let action = "estimate.created";

    if (existing) {
      if (existing.status === "declined") {
        throw new Error("This quote was declined — start a new job for new work.");
      }
      if (existing.status === "approved") {
        kind = "change_order";
        action = "estimate.change_order_created";
        await assertChangeOrderAllowed(tx, existing.id, existing.workOrderId);
      } else {
        action = "estimate.revised";
      }
      // Whatever the customer was looking at is now history.
      if (existing.currentRevisionId) {
        await tx
          .update(estimateRevisions)
          .set({ status: "superseded" })
          .where(
            and(
              eq(estimateRevisions.id, existing.currentRevisionId),
              eq(estimateRevisions.status, "presented"),
            ),
          );
      }
      const [latest] = await tx
        .select({ n: max(estimateRevisions.revision) })
        .from(estimateRevisions)
        .where(eq(estimateRevisions.estimateId, existing.id));
      revisionNumber = (latest?.n ?? 0) + 1;
    } else {
      const [created] = await tx
        .insert(estimates)
        .values({ workOrderId: input.workOrderId, status: "presented", createdBy: input.createdBy })
        .returning({ id: estimates.id });
      estimateId = created!.id;
    }

    const [revision] = await tx
      .insert(estimateRevisions)
      .values({
        estimateId: estimateId!,
        revision: revisionNumber,
        kind,
        status: "presented",
        diagnosticFeeCents: input.diagnosticFeeCents,
        taxRateBps: input.taxRateBps,
        notes: input.notes ?? null,
        createdBy: input.createdBy,
      })
      .returning({ id: estimateRevisions.id });
    await tx.insert(estimateItems).values(
      input.items.map((item, i) => ({
        revisionId: revision!.id,
        kind: item.kind,
        description: item.description,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        sortOrder: i,
      })),
    );
    await tx
      .update(estimates)
      .set({
        currentRevisionId: revision!.id,
        // An approved estimate stays approved while its change order is pending.
        status: existing?.status === "approved" ? "approved" : "presented",
        updatedAt: new Date(),
      })
      .where(eq(estimates.id, estimateId!));

    const subtotal = subtotalCents(input.items);
    await tx.insert(auditLogs).values({
      actorType: "user",
      actorId: input.createdBy,
      action,
      entityType: "estimate",
      entityId: estimateId!,
      newValue: {
        revisionId: revision!.id,
        revision: revisionNumber,
        kind,
        items: input.items.length,
        taxRateBps: input.taxRateBps,
        totalCents: subtotal + taxCents(subtotal, input.taxRateBps),
      },
    });
    return { estimateId: estimateId!, revisionId: revision!.id, revision: revisionNumber, kind };
  });
}

/** A change order needs a job that is still open to bill — paid in full *and* completed means a new job. */
async function assertChangeOrderAllowed(tx: Tx, estimateId: string, workOrderId: string) {
  const [invoice] = await tx
    .select({ id: invoices.id, status: invoices.status })
    .from(invoices)
    .where(eq(invoices.estimateId, estimateId));
  if (!invoice) return;
  if (invoice.status === "void") throw new Error("This invoice is void — create a new job instead.");
  const [order] = await tx
    .select({ status: workOrders.status })
    .from(workOrders)
    .where(eq(workOrders.id, workOrderId));
  if (invoice.status === "paid" && order?.status === "completed") {
    throw new Error(
      "This job is paid in full and completed — create a new job for additional work.",
    );
  }
}

/**
 * Records the customer's decision on the revision they were shown and
 * keeps the invoice in step, atomically:
 * - first decision: approved → items + tax, diagnostic fee waived;
 *   declined → the diagnostic fee only (spec §85). The invoice is issued here.
 * - change order: approved → the invoice totals are rebuilt from the new
 *   revision (never below what has already been paid); declined → the
 *   approved revision stands and the invoice is untouched.
 */
export async function decideEstimate(
  db: Database,
  input: { estimateId: string; decision: "approved" | "declined"; actorId: string },
): Promise<{ invoiceId: string; invoiceNumber: string; revision: number; kind: "quote" | "change_order" }> {
  return db.transaction(async (tx) => {
    const [estimate] = await tx
      .select()
      .from(estimates)
      .where(eq(estimates.id, input.estimateId))
      .for("update");
    if (!estimate) throw new Error("Estimate not found");
    const [revision] = estimate.currentRevisionId
      ? await tx
          .select()
          .from(estimateRevisions)
          .where(eq(estimateRevisions.id, estimate.currentRevisionId))
      : [];
    if (!revision || revision.status !== "presented") {
      throw new Error("This estimate has already been decided.");
    }
    const items = await tx
      .select()
      .from(estimateItems)
      .where(eq(estimateItems.revisionId, revision.id))
      .orderBy(asc(estimateItems.sortOrder));
    const now = new Date();
    const amounts = invoiceAmountsForDecision(
      input.decision,
      items,
      revision.taxRateBps,
      revision.diagnosticFeeCents,
    );

    await tx
      .update(estimateRevisions)
      .set({ status: input.decision, decidedAt: now })
      .where(eq(estimateRevisions.id, revision.id));

    if (revision.kind === "quote") {
      await tx
        .update(estimates)
        .set({
          status: input.decision,
          decidedAt: now,
          approvedRevisionId: input.decision === "approved" ? revision.id : null,
          updatedAt: now,
        })
        .where(eq(estimates.id, estimate.id));
      const [invoice] = await tx
        .insert(invoices)
        .values({
          workOrderId: estimate.workOrderId,
          estimateId: estimate.id,
          estimateRevisionId: revision.id,
          subtotalCents: amounts.subtotalCents,
          diagnosticFeeCents: amounts.diagnosticFeeCents,
          taxCents: amounts.taxCents,
          totalCents: amounts.totalCents,
        })
        .returning({ id: invoices.id, number: invoices.number });
      await tx.insert(auditLogs).values({
        actorType: "user",
        actorId: input.actorId,
        action: `estimate.${input.decision}`,
        entityType: "estimate",
        entityId: estimate.id,
        newValue: {
          revision: revision.revision,
          invoiceNumber: invoice!.number,
          totalCents: amounts.totalCents,
        },
      });
      return {
        invoiceId: invoice!.id,
        invoiceNumber: invoice!.number,
        revision: revision.revision,
        kind: "quote",
      };
    }

    // Change order on an approved estimate.
    const [invoice] = await tx
      .select()
      .from(invoices)
      .where(eq(invoices.estimateId, estimate.id))
      .for("update");
    if (!invoice) throw new Error("Invoice not found for this estimate.");

    if (input.decision === "declined") {
      await tx
        .update(estimates)
        .set({ currentRevisionId: estimate.approvedRevisionId, updatedAt: now })
        .where(eq(estimates.id, estimate.id));
      await tx.insert(auditLogs).values({
        actorType: "user",
        actorId: input.actorId,
        action: "estimate.change_order_declined",
        entityType: "estimate",
        entityId: estimate.id,
        newValue: { revision: revision.revision, invoiceNumber: invoice.number },
      });
      return {
        invoiceId: invoice.id,
        invoiceNumber: invoice.number,
        revision: revision.revision,
        kind: "change_order",
      };
    }

    if (invoice.status === "void") throw new Error("This invoice is void.");
    const paid = await ledgerPaid(tx, invoice.id);
    if (amounts.totalCents < paid) {
      throw new Error(
        `The new total (${money(amounts.totalCents)}) is below the ${money(paid)} already paid — record a refund of the difference first.`,
      );
    }
    const status = invoiceStatusFor(amounts.totalCents, paid);
    await tx
      .update(invoices)
      .set({
        estimateRevisionId: revision.id,
        subtotalCents: amounts.subtotalCents,
        diagnosticFeeCents: amounts.diagnosticFeeCents,
        taxCents: amounts.taxCents,
        totalCents: amounts.totalCents,
        status,
        paidAt: status === "paid" ? (invoice.paidAt ?? now) : null,
        updatedAt: now,
      })
      .where(eq(invoices.id, invoice.id));
    if (estimate.approvedRevisionId) {
      await tx
        .update(estimateRevisions)
        .set({ status: "superseded" })
        .where(eq(estimateRevisions.id, estimate.approvedRevisionId));
    }
    await tx
      .update(estimates)
      .set({ approvedRevisionId: revision.id, decidedAt: now, updatedAt: now })
      .where(eq(estimates.id, estimate.id));
    await tx.insert(auditLogs).values([
      {
        actorType: "user",
        actorId: input.actorId,
        action: "estimate.change_order_approved",
        entityType: "estimate",
        entityId: estimate.id,
        newValue: { revision: revision.revision, invoiceNumber: invoice.number },
      },
      {
        actorType: "user",
        actorId: input.actorId,
        action: "invoice.adjusted",
        entityType: "invoice",
        entityId: invoice.id,
        oldValue: {
          subtotalCents: invoice.subtotalCents,
          taxCents: invoice.taxCents,
          totalCents: invoice.totalCents,
          status: invoice.status,
        },
        newValue: {
          subtotalCents: amounts.subtotalCents,
          taxCents: amounts.taxCents,
          totalCents: amounts.totalCents,
          status,
          revision: revision.revision,
        },
      },
    ]);
    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      revision: revision.revision,
      kind: "change_order",
    };
  });
}

/* ------------------------------------------------------------------ */
/* Payments ledger (spec §42, §86)                                      */
/* ------------------------------------------------------------------ */

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/** SQL for net paid cents of an invoice — for list pages that can't afford a query per row. */
export function paidCentsExpr(invoiceIdColumn: SQL | typeof invoices.id): SQL<number> {
  return sql<number>`coalesce((select sum(case when p.kind = 'payment' then p.amount_cents else -p.amount_cents end) from invoice_payments p where p.invoice_id = ${invoiceIdColumn}), 0)::int`;
}

async function ledgerPaid(tx: Tx, invoiceId: string): Promise<number> {
  const rows = await tx
    .select({ kind: invoicePayments.kind, amountCents: invoicePayments.amountCents })
    .from(invoicePayments)
    .where(eq(invoicePayments.invoiceId, invoiceId));
  return netPaidCents(rows);
}

export interface RecordPaymentInput {
  invoiceId: string;
  kind?: PaymentKind;
  amountCents: number;
  method: PaymentMethod;
  reference?: string;
  note?: string;
  receivedAt?: Date;
  actorId: string;
}

export interface RecordPaymentResult {
  paymentId: string;
  receiptNumber: string;
  status: "unpaid" | "partially_paid" | "paid";
  paidCents: number;
  balanceCents: number;
  paidInFull: boolean;
}

/**
 * Appends a payment (or refund) to the invoice's ledger and recomputes the
 * invoice status in the same transaction. The invoice row is locked, so two
 * owners recording at once cannot overpay; a payment above the balance or a
 * refund above what was paid is refused outright.
 */
export async function recordInvoicePayment(
  db: Database,
  input: RecordPaymentInput,
): Promise<RecordPaymentResult> {
  const kind = input.kind ?? "payment";
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new Error("Enter an amount greater than zero.");
  }
  return db.transaction(async (tx) => {
    const [invoice] = await tx
      .select()
      .from(invoices)
      .where(eq(invoices.id, input.invoiceId))
      .for("update");
    if (!invoice) throw new Error("Invoice not found");
    if (invoice.status === "void") throw new Error("This invoice is void — it takes no payments.");

    const before = await ledgerPaid(tx, invoice.id);
    const balance = balanceCents(invoice.totalCents, before);
    if (kind === "payment") {
      if (balance <= 0) throw new Error("This invoice is already paid in full.");
      if (input.amountCents > balance) {
        throw new Error(`That's more than the ${money(balance)} balance due.`);
      }
    } else if (input.amountCents > before) {
      throw new Error(`A refund can't exceed the ${money(before)} received so far.`);
    }

    const [row] = await tx
      .insert(invoicePayments)
      .values({
        invoiceId: invoice.id,
        kind,
        amountCents: input.amountCents,
        method: input.method,
        reference: input.reference?.trim() || null,
        note: input.note?.trim() || null,
        receivedAt: input.receivedAt ?? new Date(),
        recordedBy: input.actorId,
      })
      .returning({ id: invoicePayments.id, receiptNumber: invoicePayments.receiptNumber });

    const after = before + (kind === "payment" ? input.amountCents : -input.amountCents);
    const status = invoiceStatusFor(invoice.totalCents, after);
    const now = new Date();
    await tx
      .update(invoices)
      .set({
        status,
        paidAt: status === "paid" ? (invoice.paidAt ?? input.receivedAt ?? now) : null,
        updatedAt: now,
      })
      .where(eq(invoices.id, invoice.id));
    await tx.insert(auditLogs).values({
      actorType: "user",
      actorId: input.actorId,
      action: kind === "payment" ? "invoice.payment_recorded" : "invoice.refund_recorded",
      entityType: "invoice",
      entityId: invoice.id,
      oldValue: { status: invoice.status, paidCents: before },
      newValue: {
        paymentId: row!.id,
        receiptNumber: row!.receiptNumber,
        amountCents: input.amountCents,
        method: input.method,
        reference: input.reference?.trim() || undefined,
        status,
        paidCents: after,
      },
    });
    return {
      paymentId: row!.id,
      receiptNumber: row!.receiptNumber,
      status,
      paidCents: after,
      balanceCents: balanceCents(invoice.totalCents, after),
      paidInFull: status === "paid",
    };
  });
}

/** Invoice + its ledger, oldest row first, with derived paid/balance. */
export async function invoiceLedger(db: Database, invoiceId: string) {
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));
  if (!invoice) return null;
  const payments = await db
    .select()
    .from(invoicePayments)
    .where(eq(invoicePayments.invoiceId, invoiceId))
    .orderBy(asc(invoicePayments.createdAt), asc(invoicePayments.id));
  const paid = netPaidCents(payments);
  const items = invoice.estimateRevisionId
    ? await db
        .select()
        .from(estimateItems)
        .where(eq(estimateItems.revisionId, invoice.estimateRevisionId))
        .orderBy(asc(estimateItems.sortOrder))
    : [];
  return {
    invoice,
    items,
    payments,
    paidCents: paid,
    balanceCents: balanceCents(invoice.totalCents, paid),
  };
}

/**
 * One receipt = one ledger row. "Paid through this receipt" is the running
 * total as of that row, so an old receipt still reads the way it did when
 * it was issued.
 */
export async function paymentReceipt(db: Database, paymentId: string) {
  const [payment] = await db
    .select()
    .from(invoicePayments)
    .where(eq(invoicePayments.id, paymentId));
  if (!payment) return null;
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, payment.invoiceId));
  if (!invoice) return null;
  const all = await db
    .select()
    .from(invoicePayments)
    .where(eq(invoicePayments.invoiceId, invoice.id))
    .orderBy(asc(invoicePayments.createdAt), asc(invoicePayments.id));
  const index = all.findIndex((p) => p.id === payment.id);
  const paidThrough = netPaidCents(all.slice(0, index + 1));
  return {
    payment,
    invoice,
    paidThroughCents: paidThrough,
    balanceAfterCents: balanceCents(invoice.totalCents, paidThrough),
    paidInFull: paidThrough >= invoice.totalCents,
  };
}

/* ------------------------------------------------------------------ */
/* Billing panel read model                                            */
/* ------------------------------------------------------------------ */

/** Estimate, its revisions, the current revision's items, invoices with ledgers, and the latest quote email. */
export async function billingForWorkOrder(db: Database, workOrderId: string) {
  const [estimate] = await db
    .select()
    .from(estimates)
    .where(eq(estimates.workOrderId, workOrderId));
  const revisions = estimate
    ? await db
        .select()
        .from(estimateRevisions)
        .where(eq(estimateRevisions.estimateId, estimate.id))
        .orderBy(asc(estimateRevisions.revision))
    : [];
  const allItems =
    revisions.length > 0
      ? await db
          .select()
          .from(estimateItems)
          .where(
            inArray(
              estimateItems.revisionId,
              revisions.map((r) => r.id),
            ),
          )
          .orderBy(asc(estimateItems.sortOrder))
      : [];
  const revisionSummaries = revisions.map((r) => {
    const items = allItems.filter((i) => i.revisionId === r.id);
    const sub = subtotalCents(items);
    return { ...r, items, subtotalCents: sub, taxCents: taxCents(sub, r.taxRateBps), totalCents: sub + taxCents(sub, r.taxRateBps) };
  });
  const currentRevision =
    revisionSummaries.find((r) => r.id === estimate?.currentRevisionId) ?? null;
  const approvedRevision =
    revisionSummaries.find((r) => r.id === estimate?.approvedRevisionId) ?? null;

  const invoiceRows = await db
    .select()
    .from(invoices)
    .where(eq(invoices.workOrderId, workOrderId))
    .orderBy(asc(invoices.createdAt));
  const paymentRows =
    invoiceRows.length > 0
      ? await db
          .select()
          .from(invoicePayments)
          .where(
            inArray(
              invoicePayments.invoiceId,
              invoiceRows.map((i) => i.id),
            ),
          )
          .orderBy(asc(invoicePayments.createdAt), asc(invoicePayments.id))
      : [];
  const invoiceSummaries = invoiceRows.map((inv) => {
    const payments = paymentRows.filter((p) => p.invoiceId === inv.id);
    const paid = netPaidCents(payments);
    return { ...inv, payments, paidCents: paid, balanceCents: balanceCents(inv.totalCents, paid) };
  });

  // Latest "Email quote" send for the revision on screen (older estimates
  // were emailed under the estimate id before revisions existed).
  const quoteEmail = currentRevision
    ? (await latestNotificationFor(db, {
        entityType: "estimate_revision",
        entityId: currentRevision.id,
        template: "quote_issued",
      })) ??
      (currentRevision.revision === 1 && estimate
        ? await latestNotificationFor(db, {
            entityType: "estimate",
            entityId: estimate.id,
            template: "quote_issued",
          })
        : null)
    : null;

  return {
    estimate: estimate ?? null,
    currentRevision,
    approvedRevision,
    revisions: revisionSummaries,
    items: currentRevision?.items ?? [],
    invoices: invoiceSummaries,
    quoteEmail,
  };
}

/** Invoices for a set of work orders with derived paid/balance (customer page). */
export async function invoicesForWorkOrders(db: Database, workOrderIds: string[]) {
  if (workOrderIds.length === 0) return [];
  return db
    .select({
      id: invoices.id,
      workOrderId: invoices.workOrderId,
      number: invoices.number,
      status: invoices.status,
      totalCents: invoices.totalCents,
      paidCents: paidCentsExpr(invoices.id),
      createdAt: invoices.createdAt,
    })
    .from(invoices)
    .where(inArray(invoices.workOrderId, workOrderIds))
    .orderBy(desc(invoices.createdAt));
}
