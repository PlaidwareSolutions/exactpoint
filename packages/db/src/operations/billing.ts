import { asc, eq } from "drizzle-orm";
import { invoiceAmountsForDecision, type LineItemKind, type PaymentMethod } from "@exactpoint/domain";
import type { Database } from "../client";
import { auditLogs, estimateItems, estimates, invoices } from "../schema";
import { latestNotificationFor } from "./notifications";

export interface EstimateItemInput {
  kind: LineItemKind;
  description: string;
  quantity: number;
  unitPriceCents: number;
}

/** Creates or replaces the work order's draft estimate (spec §85). */
export async function upsertEstimate(
  db: Database,
  input: {
    workOrderId: string;
    items: EstimateItemInput[];
    taxRateBps: number;
    diagnosticFeeCents: number;
    notes?: string;
    createdBy: string;
  },
): Promise<{ estimateId: string }> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: estimates.id, status: estimates.status })
      .from(estimates)
      .where(eq(estimates.workOrderId, input.workOrderId));
    if (existing && existing.status !== "draft" && existing.status !== "presented") {
      throw new Error("This estimate has already been decided.");
    }
    let estimateId = existing?.id;
    if (estimateId) {
      await tx
        .update(estimates)
        .set({
          taxRateBps: input.taxRateBps,
          diagnosticFeeCents: input.diagnosticFeeCents,
          notes: input.notes ?? null,
          status: "presented",
          updatedAt: new Date(),
        })
        .where(eq(estimates.id, estimateId));
      await tx.delete(estimateItems).where(eq(estimateItems.estimateId, estimateId));
    } else {
      const [created] = await tx
        .insert(estimates)
        .values({
          workOrderId: input.workOrderId,
          status: "presented",
          diagnosticFeeCents: input.diagnosticFeeCents,
          taxRateBps: input.taxRateBps,
          notes: input.notes ?? null,
          createdBy: input.createdBy,
        })
        .returning({ id: estimates.id });
      estimateId = created!.id;
    }
    if (input.items.length > 0) {
      await tx.insert(estimateItems).values(
        input.items.map((item, i) => ({
          estimateId: estimateId!,
          kind: item.kind,
          description: item.description,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          sortOrder: i,
        })),
      );
    }
    await tx.insert(auditLogs).values({
      actorType: "user",
      actorId: input.createdBy,
      action: existing ? "estimate.updated" : "estimate.created",
      entityType: "estimate",
      entityId: estimateId!,
      newValue: { items: input.items.length, taxRateBps: input.taxRateBps },
    });
    return { estimateId: estimateId! };
  });
}

/**
 * Records the customer's decision and issues the matching invoice atomically:
 * approved → items + tax, diagnostic fee waived; declined → $80 fee only.
 */
export async function decideEstimate(
  db: Database,
  input: { estimateId: string; decision: "approved" | "declined"; actorId: string },
): Promise<{ invoiceId: string; invoiceNumber: string }> {
  return db.transaction(async (tx) => {
    const [estimate] = await tx
      .select()
      .from(estimates)
      .where(eq(estimates.id, input.estimateId));
    if (!estimate) throw new Error("Estimate not found");
    if (estimate.status === "approved" || estimate.status === "declined") {
      throw new Error("This estimate has already been decided.");
    }
    const items = await tx
      .select()
      .from(estimateItems)
      .where(eq(estimateItems.estimateId, input.estimateId))
      .orderBy(asc(estimateItems.sortOrder));

    await tx
      .update(estimates)
      .set({ status: input.decision, decidedAt: new Date(), updatedAt: new Date() })
      .where(eq(estimates.id, input.estimateId));

    const amounts = invoiceAmountsForDecision(
      input.decision,
      items,
      estimate.taxRateBps,
      estimate.diagnosticFeeCents,
    );
    const [invoice] = await tx
      .insert(invoices)
      .values({
        workOrderId: estimate.workOrderId,
        estimateId: estimate.id,
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
      newValue: { invoiceNumber: invoice!.number, totalCents: amounts.totalCents },
    });
    return { invoiceId: invoice!.id, invoiceNumber: invoice!.number };
  });
}

export async function recordInvoicePayment(
  db: Database,
  input: { invoiceId: string; method: PaymentMethod; actorId: string },
): Promise<void> {
  await db.transaction(async (tx) => {
    const [invoice] = await tx
      .select({ status: invoices.status })
      .from(invoices)
      .where(eq(invoices.id, input.invoiceId));
    if (!invoice) throw new Error("Invoice not found");
    if (invoice.status === "paid") throw new Error("Invoice is already paid.");
    await tx
      .update(invoices)
      .set({
        status: "paid",
        paymentMethod: input.method,
        paidAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, input.invoiceId));
    await tx.insert(auditLogs).values({
      actorType: "user",
      actorId: input.actorId,
      action: "invoice.paid",
      entityType: "invoice",
      entityId: input.invoiceId,
      newValue: { method: input.method },
    });
  });
}

/** Estimate + items + invoices + latest quote email for a work order (billing panel). */
export async function billingForWorkOrder(db: Database, workOrderId: string) {
  const [estimate] = await db
    .select()
    .from(estimates)
    .where(eq(estimates.workOrderId, workOrderId));
  const items = estimate
    ? await db
        .select()
        .from(estimateItems)
        .where(eq(estimateItems.estimateId, estimate.id))
        .orderBy(asc(estimateItems.sortOrder))
    : [];
  const invoiceRows = await db
    .select()
    .from(invoices)
    .where(eq(invoices.workOrderId, workOrderId));
  // Latest "Email quote" send, so the panel can show whether it was delivered.
  const quoteEmail = estimate
    ? await latestNotificationFor(db, {
        entityType: "estimate",
        entityId: estimate.id,
        template: "quote_issued",
      })
    : null;
  return { estimate: estimate ?? null, items, invoices: invoiceRows, quoteEmail };
}
