import type { billingForWorkOrder } from "@exactpoint/db";
import type { EmailDeliveryStatus } from "@exactpoint/domain";
import type { BillingData } from "@/app/manager/jobs/[id]/billing-panel";
import type { LedgerInvoice } from "@/components/billing/payment-ledger";

type Billing = Awaited<ReturnType<typeof billingForWorkOrder>>;

export function toLedgerInvoice(inv: Billing["invoices"][number]): LedgerInvoice {
  return {
    id: inv.id,
    number: inv.number,
    status: inv.status,
    totalCents: inv.totalCents,
    paidCents: inv.paidCents,
    balanceCents: inv.balanceCents,
    payments: inv.payments.map((p) => ({
      id: p.id,
      kind: p.kind,
      amountCents: p.amountCents,
      method: p.method,
      reference: p.reference,
      note: p.note,
      receiptNumber: p.receiptNumber,
      receivedAt: p.receivedAt.toISOString(),
    })),
  };
}

/** Serialises the billing query for the client-side BillingPanel. */
export function toBillingData(workOrderId: string, billing: Billing): BillingData {
  const email = billing.quoteEmail;
  const revision = (r: Billing["revisions"][number]) => ({
    id: r.id,
    revision: r.revision,
    kind: r.kind,
    status: r.status,
    taxRateBps: r.taxRateBps,
    diagnosticFeeCents: r.diagnosticFeeCents,
    notes: r.notes,
    createdAt: r.createdAt.toISOString(),
    decidedAt: r.decidedAt?.toISOString() ?? null,
    subtotalCents: r.subtotalCents,
    taxCents: r.taxCents,
    totalCents: r.totalCents,
    items: r.items.map((i) => ({
      kind: i.kind,
      description: i.description,
      quantity: i.quantity,
      unitPriceCents: i.unitPriceCents,
    })),
  });
  return {
    workOrderId,
    estimate: billing.estimate
      ? {
          id: billing.estimate.id,
          status: billing.estimate.status,
          currentRevisionId: billing.estimate.currentRevisionId,
          approvedRevisionId: billing.estimate.approvedRevisionId,
        }
      : null,
    currentRevision: billing.currentRevision ? revision(billing.currentRevision) : null,
    approvedRevision: billing.approvedRevision ? revision(billing.approvedRevision) : null,
    revisions: billing.revisions.map(revision),
    invoices: billing.invoices.map((inv) => ({
      ...toLedgerInvoice(inv),
      diagnosticFeeCents: inv.diagnosticFeeCents,
    })),
    quoteEmail: email
      ? {
          status: email.status,
          delivery: (email.deliveryStatus as EmailDeliveryStatus | null) ?? null,
          deliveryDetail: email.deliveryDetail,
          recipient: email.recipient,
          error: email.error,
          createdAt: email.createdAt.toISOString(),
          sentAt: email.sentAt?.toISOString() ?? null,
          deliveryUpdatedAt: email.deliveryUpdatedAt?.toISOString() ?? null,
        }
      : null,
  };
}
