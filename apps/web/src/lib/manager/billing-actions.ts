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
  enqueueEmailOnce,
  estimateItems,
  estimateRevisions,
  estimates,
  getDb,
  invoiceLedger,
  invoices,
  paymentReceipt,
  recordInvoicePayment,
  saveEstimateRevision,
  workOrders,
} from "@exactpoint/db";
import {
  BUSINESS,
  LINE_ITEM_KINDS,
  PAYMENT_KINDS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  SERVICE_AGREEMENT,
  SERVICE_AGREEMENT_URL,
  serviceAgreementText,
  subtotalCents,
  taxCents,
} from "@exactpoint/domain";
import { requireOwner } from "@/lib/session";
import {
  emitJobRevenue,
  emitLead,
  emitQualified,
  emitRepairDeclined,
  journeyForWorkOrder,
  leadIdForEstimate,
  leadIdForWorkOrder,
} from "@/lib/mhub/events";
import type { ActionResult } from "./schedule-actions";

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

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

/**
 * Saves the quote as a new revision. Before a decision it replaces what the
 * customer sees; after approval it becomes a change order awaiting its own
 * approval (spec §85).
 */
export async function saveEstimate(
  input: unknown,
): Promise<ActionResult & { revision?: number; kind?: "quote" | "change_order" }> {
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
  let saved: Awaited<ReturnType<typeof saveEstimateRevision>>;
  try {
    saved = await saveEstimateRevision(db, {
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
  if (saved.kind === "quote") emitQualified(await leadIdForWorkOrder(parsed.data.workOrderId));
  revalidatePath("/manager/jobs");
  return { ok: true, revision: saved.revision, kind: saved.kind };
}

const decisionSchema = z.object({
  estimateId: z.uuid(),
  decision: z.enum(["approved", "declined"]),
});

export async function decideEstimateAction(input: unknown): Promise<ActionResult> {
  const session = await requireOwner();
  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid decision." };
  let decided: Awaited<ReturnType<typeof decideEstimate>>;
  try {
    decided = await decideEstimate(getDb(), {
      estimateId: parsed.data.estimateId,
      decision: parsed.data.decision,
      actorId: session.user.id,
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not record decision." };
  }
  // A declined *change order* is not a declined repair — the approved work stands.
  if (parsed.data.decision === "declined" && decided.kind === "quote") {
    const leadId = await leadIdForEstimate(parsed.data.estimateId);
    if (leadId) emitRepairDeclined(leadId, parsed.data.estimateId);
  }
  revalidatePath("/manager/jobs");
  revalidatePath("/manager/invoices");
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

async function customerForWorkOrder(workOrderId: string) {
  const [customer] = await getDb()
    .select({ email: customers.email, firstName: customers.firstName })
    .from(workOrders)
    .innerJoin(customers, eq(workOrders.customerId, customers.id))
    .where(eq(workOrders.id, workOrderId));
  return customer ?? null;
}

/** Emails the quote revision the customer is meant to see — safe to tap twice. */
export async function emailQuote(estimateId: string): Promise<ActionResult> {
  const session = await requireOwner();
  const parsed = z.uuid().safeParse(estimateId);
  if (!parsed.success) return { ok: false, error: "Invalid quote." };
  const db = getDb();

  const [estimate] = await db.select().from(estimates).where(eq(estimates.id, parsed.data));
  if (!estimate?.currentRevisionId) return { ok: false, error: "Quote not found." };
  const [revision] = await db
    .select()
    .from(estimateRevisions)
    .where(eq(estimateRevisions.id, estimate.currentRevisionId));
  if (!revision) return { ok: false, error: "Quote not found." };
  if (revision.status !== "presented") {
    return { ok: false, error: "This quote has been decided — nothing to send." };
  }
  const customer = await customerForWorkOrder(estimate.workOrderId);
  if (!customer?.email) return { ok: false, error: "This customer has no email on file." };

  const items = await db
    .select()
    .from(estimateItems)
    .where(eq(estimateItems.revisionId, revision.id))
    .orderBy(asc(estimateItems.sortOrder));
  if (items.length === 0) return { ok: false, error: "Add at least one line first." };

  const subtotal = subtotalCents(items);
  const tax = taxCents(subtotal, revision.taxRateBps);
  // Idempotent per revision: a double-tap, or a retry while the previous
  // send is still queued / just went out, reuses that send instead of
  // emailing twice. A new revision is a new entity, so it can go right away.
  const queued = await enqueueEmailOnce(db, {
    template: "quote_issued",
    recipient: customer.email,
    entity: { type: "estimate_revision", id: revision.id },
    dedupeWindowSeconds: 60,
    payload: {
      firstName: customer.firstName,
      kind: revision.kind,
      revision: revision.revision,
      linesText: items
        .map((i) => `  ${i.description} (x${i.quantity}) — ${money(i.quantity * i.unitPriceCents)}`)
        .join("\n"),
      totalsText: [
        `Subtotal: ${money(subtotal)}`,
        `Tax: ${money(tax)}`,
        `Quoted total: ${money(subtotal + tax)}`,
        ...(revision.notes ? ["", `Notes: ${revision.notes}`] : []),
      ].join("\n"),
      // The exact terms sent are stored on the notification row, so the
      // record shows what the customer agreed to when they approved.
      agreementVersion: SERVICE_AGREEMENT.version,
      agreementText: serviceAgreementText(),
    },
  });
  if (!queued.queued) {
    return {
      ok: true,
      warnings: [
        queued.reason === "pending"
          ? "Already on its way — the previous send is still going out."
          : "Already sent a moment ago — not sending twice.",
      ],
    };
  }
  await db.insert(auditLogs).values({
    actorType: "user",
    actorId: session.user.id,
    action: "estimate.emailed",
    entityType: "estimate",
    entityId: estimate.id,
    newValue: {
      recipient: customer.email,
      revision: revision.revision,
      kind: revision.kind,
      notificationId: queued.notificationId,
      agreementVersion: SERVICE_AGREEMENT.version,
    },
  });
  return { ok: true };
}

/** Emails the invoice itself (with paid-to-date and balance) to the customer on demand. */
export async function emailInvoice(invoiceId: string): Promise<ActionResult> {
  const session = await requireOwner();
  const parsed = z.uuid().safeParse(invoiceId);
  if (!parsed.success) return { ok: false, error: "Invalid invoice." };
  const db = getDb();

  const ledger = await invoiceLedger(db, parsed.data);
  if (!ledger) return { ok: false, error: "Invoice not found." };
  const { invoice, items } = ledger;
  const customer = await customerForWorkOrder(invoice.workOrderId);
  if (!customer?.email) {
    return { ok: false, error: "This customer has no email on file." };
  }

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
  totals.push(`Invoice total: ${money(invoice.totalCents)}`);
  if (ledger.paidCents > 0) totals.push(`Paid to date: ${money(ledger.paidCents)}`);
  totals.push(
    ledger.balanceCents <= 0 ? "Balance due: $0.00 — paid in full" : `Balance due: ${money(ledger.balanceCents)}`,
  );

  await enqueueEmail(db, {
    template: "invoice_issued",
    recipient: customer.email,
    entity: { type: "invoice", id: invoice.id },
    payload: {
      firstName: customer.firstName,
      reference: invoice.number,
      linesText: lines.join("\n"),
      totalsText: totals.join("\n"),
      paymentMethods: BUSINESS.paymentMethods.join(", "),
      agreementUrl: SERVICE_AGREEMENT_URL,
    },
  });
  await db.insert(auditLogs).values({
    actorType: "user",
    actorId: session.user.id,
    action: "invoice.emailed",
    entityType: "invoice",
    entityId: invoice.id,
    newValue: { number: invoice.number, recipient: customer.email },
  });
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Payments ledger                                                     */
/* ------------------------------------------------------------------ */

const paymentSchema = z.object({
  invoiceId: z.uuid(),
  kind: z.enum(PAYMENT_KINDS).default("payment"),
  /** Dollars as typed by the owner — converted to integer cents here. */
  amount: z.coerce.number().positive("Enter an amount greater than zero.").max(1_000_000),
  method: z.enum(PAYMENT_METHODS),
  reference: z.string().trim().max(80).optional().or(z.literal("")),
  note: z.string().trim().max(500).optional().or(z.literal("")),
  /** YYYY-MM-DD in the business timezone; defaults to now. */
  receivedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
});

export type RecordPaymentActionResult = ActionResult & {
  receiptNumber?: string;
  paymentId?: string;
  status?: string;
  balanceCents?: number;
};

/**
 * Records a payment or refund, queues the receipt email, and emits the
 * revenue increment for this ledger row (spec §42, §86).
 */
export async function recordPaymentAction(input: unknown): Promise<RecordPaymentActionResult> {
  const session = await requireOwner();
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the payment." };
  }
  const data = parsed.data;
  const amountCents = Math.round(data.amount * 100);
  const receivedAt = data.receivedOn ? receivedOnToInstant(data.receivedOn) : undefined;
  if (receivedAt && receivedAt.getTime() > Date.now() + 24 * 3600_000) {
    return { ok: false, error: "The payment date can't be in the future." };
  }
  const db = getDb();
  let result: Awaited<ReturnType<typeof recordInvoicePayment>>;
  try {
    result = await recordInvoicePayment(db, {
      invoiceId: data.invoiceId,
      kind: data.kind,
      amountCents,
      method: data.method,
      reference: data.reference || undefined,
      note: data.note || undefined,
      receivedAt,
      actorId: session.user.id,
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not record payment." };
  }

  const warnings: string[] = [];
  // Receipt email — one per ledger row (the worker sends when a provider is configured).
  const receipt = await queueReceiptEmail(result.paymentId);
  if (!receipt.ok) warnings.push(receipt.error);

  // Revenue increment for this row (MHub sums across events; the payment id
  // in the idempotency key makes a retried action safe). Refunds subtract.
  const [invoice] = await db
    .select({ workOrderId: invoices.workOrderId })
    .from(invoices)
    .where(eq(invoices.id, data.invoiceId));
  if (invoice) {
    const journey = await journeyForWorkOrder(invoice.workOrderId);
    if (journey) {
      emitJobRevenue(journey.leadId, {
        paymentId: result.paymentId,
        revenueCents: data.kind === "refund" ? -amountCents : amountCents,
        technicianFirstName: journey.technicianFirstName,
        email: journey.customerEmail,
        phone: journey.customerPhone,
      });
    }
  }
  revalidatePath("/manager/jobs");
  revalidatePath("/manager/invoices");
  return {
    ok: true,
    receiptNumber: result.receiptNumber,
    paymentId: result.paymentId,
    status: result.status,
    balanceCents: result.balanceCents,
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

/** Midnight at the start of that calendar day in the business timezone, as an instant. */
function receivedOnToInstant(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  // Noon local avoids DST edge cases while staying on the chosen day.
  const guess = new Date(Date.UTC(y!, m! - 1, d!, 12));
  const local = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS.timezone,
    hour: "numeric",
    hour12: false,
  }).format(guess);
  const offsetHours = 12 - Number(local === "24" ? 0 : local);
  return new Date(guess.getTime() + offsetHours * 3600_000);
}

/** (Re)sends the receipt for one ledger row — idempotent, never two in a minute. */
export async function emailReceipt(paymentId: string): Promise<ActionResult> {
  const session = await requireOwner();
  const parsed = z.uuid().safeParse(paymentId);
  if (!parsed.success) return { ok: false, error: "Invalid receipt." };
  const queued = await queueReceiptEmail(parsed.data);
  if (!queued.ok) return queued;
  if (queued.deduped) {
    return { ok: true, warnings: ["Already sent a moment ago — not sending twice."] };
  }
  await getDb().insert(auditLogs).values({
    actorType: "user",
    actorId: session.user.id,
    action: "invoice.receipt_emailed",
    entityType: "invoice_payment",
    entityId: parsed.data,
    newValue: { recipient: queued.recipient },
  });
  return { ok: true };
}

async function queueReceiptEmail(
  paymentId: string,
): Promise<{ ok: true; deduped: boolean; recipient: string } | { ok: false; error: string }> {
  const db = getDb();
  const receipt = await paymentReceipt(db, paymentId);
  if (!receipt) return { ok: false, error: "Receipt not found." };
  const customer = await customerForWorkOrder(receipt.invoice.workOrderId);
  if (!customer?.email) return { ok: false, error: "No receipt emailed — this customer has no email on file." };
  const { payment, invoice } = receipt;
  const queued = await enqueueEmailOnce(db, {
    template: "payment_receipt",
    recipient: customer.email,
    entity: { type: "invoice_payment", id: payment.id },
    dedupeWindowSeconds: 60,
    payload: {
      firstName: customer.firstName,
      reference: invoice.number,
      kind: payment.kind,
      receiptNumber: payment.receiptNumber,
      amountLabel: money(payment.amountCents),
      methodLabel: PAYMENT_METHOD_LABELS[payment.method] ?? payment.method,
      paymentReference: payment.reference ?? "",
      totalLabel: money(invoice.totalCents),
      paidToDateLabel: money(receipt.paidThroughCents),
      balanceLabel: money(Math.max(0, receipt.balanceAfterCents)),
      paidInFull: receipt.paidInFull,
      paymentMethods: BUSINESS.paymentMethods.join(", "),
    },
  });
  return { ok: true, deduped: !queued.queued, recipient: customer.email };
}
