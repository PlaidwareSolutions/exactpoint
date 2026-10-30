import type { billingForWorkOrder } from "@exactpoint/db";
import type { EmailDeliveryStatus } from "@exactpoint/domain";
import type { BillingData } from "@/app/manager/jobs/[id]/billing-panel";

type Billing = Awaited<ReturnType<typeof billingForWorkOrder>>;

/** Serialises the billing query for the client-side BillingPanel. */
export function toBillingData(workOrderId: string, billing: Billing): BillingData {
  const email = billing.quoteEmail;
  return {
    workOrderId,
    estimate: billing.estimate
      ? {
          id: billing.estimate.id,
          status: billing.estimate.status,
          taxRateBps: billing.estimate.taxRateBps,
          diagnosticFeeCents: billing.estimate.diagnosticFeeCents,
          notes: billing.estimate.notes,
        }
      : null,
    items: billing.items.map((i) => ({
      kind: i.kind,
      description: i.description,
      quantity: i.quantity,
      unitPriceCents: i.unitPriceCents,
    })),
    invoices: billing.invoices.map((inv) => ({
      id: inv.id,
      number: inv.number,
      status: inv.status,
      totalCents: inv.totalCents,
      diagnosticFeeCents: inv.diagnosticFeeCents,
      paymentMethod: inv.paymentMethod,
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
