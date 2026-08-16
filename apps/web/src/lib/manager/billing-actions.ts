"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq } from "drizzle-orm";
import {
  businessSettings,
  customers,
  decideEstimate,
  enqueueEmail,
  getDb,
  invoices,
  recordInvoicePayment,
  upsertEstimate,
  workOrders,
} from "@exactpoint/db";
import { LINE_ITEM_KINDS, PAYMENT_METHODS } from "@exactpoint/domain";
import { requireOwner } from "@/lib/session";
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
  revalidatePath("/manager/jobs");
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
  }
  revalidatePath("/manager/jobs");
  return { ok: true };
}
