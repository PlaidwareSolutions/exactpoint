"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { asc, eq } from "drizzle-orm";
import {
  auditLogs,
  businessSettings,
  customers,
  decideEstimate,
  enqueueEmail,
  estimateItems,
  estimates,
  getDb,
  invoices,
  recordInvoicePayment,
  upsertEstimate,
  workOrders,
} from "@exactpoint/db";
import { LINE_ITEM_KINDS, PAYMENT_METHODS } from "@exactpoint/domain";
import { requireOwner } from "@/lib/session";
import {
  emitJobCompleted,
  emitLead,
  emitQualified,
  emitRepairDeclined,
  journeyForWorkOrder,
  leadIdForEstimate,
  leadIdForWorkOrder,
} from "@/lib/mhub/events";
import type { ActionResult } from "./schedule-actions";

const itemSchema = z.object({
  kind: z.enum(LINE_ITEM_KINDS),
  description: z.string().trim().min(2).max(200),
  quantity: z.coerce.number().int().min(1).max(99),
  unitPriceCents: z.coerce.number().int().min(0).max(5_000_000),
});

const estimateSchema = z.object({
  workOrderId: z.uuid(),
  items: z.array(itemSchema).min(1, "Add at least one line item").max(30),
  taxRateBps: z.coerce.number().int().min(0).max(2000),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

export async function saveEstimate(input: unknown): Promise<ActionResult> {
  const session = await requireOwner();
  const parsed = estimateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the estimate." };
  }
  const db = getDb();
  const [settings] = await db
    .select({ fee: businessSettings.diagnosticFeeCents })
    .from(businessSettings)
    .where(eq(businessSettings.id, 1));
  try {
    await upsertEstimate(db, {
      workOrderId: parsed.data.workOrderId,
      items: parsed.data.items,
      taxRateBps: parsed.data.taxRateBps,
      diagnosticFeeCents: settings?.fee ?? 8000,
      notes: parsed.data.notes || undefined,
      createdBy: session.user.id,
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not save estimate." };
  }
  emitQualified(await leadIdForWorkOrder(parsed.data.workOrderId));
  revalidatePath("/manager/jobs");
  return { ok: true };
}

const decisionSchema = z.object({
  estimateId: z.uuid(),
  decision: z.enum(["approved", "declined"]),
});

export async function decideEstimateAction(input: unknown): Promise<ActionResult> {
  const session = await requireOwner();
  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid decision." };
  try {
    await decideEstimate(getDb(), {
      estimateId: parsed.data.estimateId,
      decision: parsed.data.decision,
      actorId: session.user.id,
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not record decision." };
  }
  if (parsed.data.decision === "declined") {
    const leadId = await leadIdForEstimate(parsed.data.estimateId);
    if (leadId) emitRepairDeclined(leadId, parsed.data.estimateId);
  }
  revalidatePath("/manager/jobs");
  return { ok: true };
}

/**
 * Creates a bare work order for quote-first customers (no appointment yet)
 * so the owner can price a job before anything is scheduled.
 */
export async function createQuoteDraft(
  customerId: string,
  addressId: string,
): Promise<ActionResult & { workOrderId?: string }> {
  const session = await requireOwner();
  const ids = z.object({ c: z.uuid(), a: z.uuid() }).safeParse({ c: customerId, a: addressId });
  if (!ids.success) return { ok: false, error: "Invalid customer or address." };
  const db = getDb();
  const [wo] = await db
    .insert(workOrders)
    .values({ customerId: ids.data.c, addressId: ids.data.a, status: "open" })
    .returning({ id: workOrders.id });
  await db.insert(auditLogs).values({
    actorType: "user",
    actorId: session.user.id,
    action: "work_order.quote_draft_created",
    entityType: "work_order",
    entityId: wo!.id,
  });
  const [contact] = await db
    .select({ phone: customers.phone, email: customers.email })
    .from(customers)
    .where(eq(customers.id, ids.data.c));
  emitLead({
    leadId: `WO-${wo!.id}`,
    phone: contact?.phone,
    email: contact?.email,
    source: "phone",
  });
  return { ok: true, workOrderId: wo!.id };
}

/** Emails the current quote (undecided estimate) to the customer. */
export async function emailQuote(estimateId: string): Promise<ActionResult> {
  const session = await requireOwner();
  const parsed = z.uuid().safeParse(estimateId);
  if (!parsed.success) return { ok: false, error: "Invalid quote." };
  const db = getDb();

  const [estimate] = await db
    .select()
    .from(estimates)
    .where(eq(estimates.id, parsed.data));
  if (!estimate) return { ok: false, error: "Quote not found." };
  const [customer] = await db
    .select({ email: customers.email, firstName: customers.firstName })
    .from(workOrders)
    .innerJoin(customers, eq(workOrders.customerId, customers.id))
    .where(eq(workOrders.id, estimate.workOrderId));
  if (!customer?.email) return { ok: false, error: "This customer has no email on file." };

  const items = await db
    .select()
    .from(estimateItems)
    .where(eq(estimateItems.estimateId, estimate.id))
    .orderBy(asc(estimateItems.sortOrder));
  if (items.length === 0) return { ok: false, error: "Add at least one line first." };

  const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPriceCents, 0);
  const tax = Math.round((subtotal * estimate.taxRateBps) / 10_000);
  await enqueueEmail(db, {
    template: "quote_issued",
    recipient: customer.email,
    payload: {
      firstName: customer.firstName,
      linesText: items
        .map((i) => `  ${i.description} (x${i.quantity}) — ${money(i.quantity * i.unitPriceCents)}`)
        .join("\n"),
      totalsText: [
        `Subtotal: ${money(subtotal)}`,
        `Tax: ${money(tax)}`,
        `Quoted total: ${money(subtotal + tax)}`,
      ].join("\n"),
    },
  });
  await db.insert(auditLogs).values({
    actorType: "user",
    actorId: session.user.id,
    action: "estimate.emailed",
    entityType: "estimate",
    entityId: estimate.id,
    newValue: { recipient: customer.email },
  });
  return { ok: true };
}

/** Emails the invoice itself (before payment) to the customer on demand. */
export async function emailInvoice(invoiceId: string): Promise<ActionResult> {
  const session = await requireOwner();
  const parsed = z.uuid().safeParse(invoiceId);
  if (!parsed.success) return { ok: false, error: "Invalid invoice." };
  const db = getDb();

  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, parsed.data));
  if (!invoice) return { ok: false, error: "Invoice not found." };
  const [customer] = await db
    .select({ email: customers.email, firstName: customers.firstName })
    .from(workOrders)
    .innerJoin(customers, eq(workOrders.customerId, customers.id))
    .where(eq(workOrders.id, invoice.workOrderId));
  if (!customer?.email) {
    return { ok: false, error: "This customer has no email on file." };
  }

  const items = invoice.estimateId
    ? await db
        .select()
        .from(estimateItems)
        .where(eq(estimateItems.estimateId, invoice.estimateId))
        .orderBy(asc(estimateItems.sortOrder))
    : [];
  const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const lines: string[] = [];
  if (invoice.diagnosticFeeCents > 0) {
    lines.push(`  Diagnostic / service-call fee — ${money(invoice.diagnosticFeeCents)}`);
  }
  if (invoice.subtotalCents > 0) {
    for (const item of items) {
      lines.push(
        `  ${item.description} (x${item.quantity}) — ${money(item.quantity * item.unitPriceCents)}`,
      );
    }
  }
  const totals: string[] = [];
  if (invoice.subtotalCents > 0) {
    totals.push(`Subtotal: ${money(invoice.subtotalCents)}`);
    totals.push(`Tax: ${money(invoice.taxCents)}`);
    totals.push("Diagnostic fee: waived");
  }
  totals.push(`Total due: ${money(invoice.totalCents)}`);

  await enqueueEmail(db, {
    template: "invoice_issued",
    recipient: customer.email,
    payload: {
      firstName: customer.firstName,
      reference: invoice.number,
      linesText: lines.join("\n"),
      totalsText: totals.join("\n"),
      paymentMethods: "Zelle, Cash, Check",
    },
  });
  await getDb().insert(auditLogs).values({
    actorType: "user",
    actorId: session.user.id,
    action: "invoice.emailed",
    entityType: "invoice",
    entityId: invoice.id,
    newValue: { number: invoice.number, recipient: customer.email },
  });
  return { ok: true };
}

const paymentSchema = z.object({
  invoiceId: z.uuid(),
  method: z.enum(PAYMENT_METHODS),
});

export async function recordPaymentAction(input: unknown): Promise<ActionResult> {
  const session = await requireOwner();
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid payment." };
  const db = getDb();
  try {
    await recordInvoicePayment(db, {
      invoiceId: parsed.data.invoiceId,
      method: parsed.data.method,
      actorId: session.user.id,
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not record payment." };
  }

  // Receipt email (worker sends when a provider is configured).
  const [invoice] = await db
    .select({ number: invoices.number, totalCents: invoices.totalCents, workOrderId: invoices.workOrderId })
    .from(invoices)
    .where(eq(invoices.id, parsed.data.invoiceId));
  if (invoice) {
    const [customer] = await db
      .select({ email: customers.email, firstName: customers.firstName })
      .from(workOrders)
      .innerJoin(customers, eq(workOrders.customerId, customers.id))
      .where(eq(workOrders.id, invoice.workOrderId));
    if (customer?.email) {
      await enqueueEmail(db, {
        template: "invoice_receipt",
        recipient: customer.email,
        payload: {
          firstName: customer.firstName,
          reference: invoice.number,
          totalLabel: `$${(invoice.totalCents / 100).toFixed(2)}`,
        },
      });
    }
    // Close the marketing loop with final revenue — dedupes against the
    // completion-time emit when the invoice already existed then.
    const journey = await journeyForWorkOrder(invoice.workOrderId);
    if (journey) {
      emitJobCompleted(journey.leadId, {
        revenueCents: invoice.totalCents,
        technicianFirstName: journey.technicianFirstName,
        email: journey.customerEmail,
        phone: journey.customerPhone,
      });
    }
  }
  revalidatePath("/manager/jobs");
  return { ok: true };
}
