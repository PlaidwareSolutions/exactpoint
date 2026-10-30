import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { customerAddresses, customers, getDb, paymentReceipt, workOrders } from "@exactpoint/db";
import { BUSINESS, PAYMENT_METHOD_LABELS, formatCents } from "@exactpoint/domain";
import { LogoBadge } from "@/components/brand/logo";
import { ReceiptActions } from "./receipt-actions";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS.timezone,
  month: "long",
  day: "numeric",
  year: "numeric",
});

/** Print-friendly receipt for one payment (or refund) — spec §42. */
export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ id: string; paymentId: string }>;
}) {
  const { id, paymentId } = await params;
  const db = getDb();
  const receipt = await paymentReceipt(db, paymentId);
  if (!receipt || receipt.invoice.id !== id) notFound();
  const { payment, invoice } = receipt;
  const [order] = await db
    .select({
      customerFirst: customers.firstName,
      customerLast: customers.lastName,
      customerEmail: customers.email,
      street: customerAddresses.street,
      unit: customerAddresses.unit,
      city: customerAddresses.city,
      state: customerAddresses.state,
      zip: customerAddresses.zip,
    })
    .from(workOrders)
    .innerJoin(customers, eq(workOrders.customerId, customers.id))
    .innerJoin(customerAddresses, eq(workOrders.addressId, customerAddresses.id))
    .where(eq(workOrders.id, invoice.workOrderId));
  const refund = payment.kind === "refund";

  return (
    <>
      <ReceiptActions
        invoiceId={invoice.id}
        paymentId={payment.id}
        customerEmail={order?.customerEmail ?? null}
      />
      <div className="mx-auto max-w-2xl rounded-xl border border-line bg-white p-8 print:border-0">
        <header className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <LogoBadge size={44} />
            <div>
              <p className="text-lg font-extrabold tracking-wide text-navy">EXACTPOINT</p>
              <p className="text-xs text-slate">{BUSINESS.legalName}</p>
              <p className="text-xs text-slate">
                {BUSINESS.phone} · {BUSINESS.email}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-slate">{refund ? "Refund receipt" : "Receipt"}</p>
            <p className="text-xl font-extrabold text-navy" data-testid="receipt-number">
              {payment.receiptNumber}
            </p>
            <p className="text-xs text-slate">{dateFmt.format(payment.receivedAt)}</p>
          </div>
        </header>

        {order && (
          <p className="mt-6 text-sm text-slate">
            {refund ? "Refunded to" : "Received from"}:{" "}
            <span className="font-semibold text-navy">
              {order.customerFirst} {order.customerLast}
            </span>
            , {order.street}
            {order.unit ? `, ${order.unit}` : ""}, {order.city}, {order.state} {order.zip}
          </p>
        )}

        <div className="mt-6 rounded-xl bg-mist px-6 py-5 text-center">
          <p className="text-xs uppercase tracking-wider text-slate">{refund ? "Amount refunded" : "Amount received"}</p>
          <p className={`text-3xl font-extrabold tabular-nums ${refund ? "text-red-700" : "text-navy"}`}>
            {refund ? "−" : ""}
            {formatCents(payment.amountCents)}
          </p>
          <p className="mt-1 text-sm text-slate">
            by {PAYMENT_METHOD_LABELS[payment.method] ?? payment.method}
            {payment.reference ? ` · ${payment.reference}` : ""}
          </p>
          {payment.note && <p className="mt-1 text-xs text-slate">{payment.note}</p>}
        </div>

        <dl className="ml-auto mt-6 w-64 space-y-1 text-sm">
          <div className="flex justify-between text-slate">
            <dt>Invoice</dt>
            <dd className="font-semibold text-navy">
              <a href={`/manager/invoices/${invoice.id}`} className="hover:text-point">
                {invoice.number}
              </a>
            </dd>
          </div>
          <div className="flex justify-between text-slate">
            <dt>Invoice total</dt>
            <dd className="tabular-nums">{formatCents(invoice.totalCents)}</dd>
          </div>
          <div className="flex justify-between text-slate">
            <dt>Paid to date</dt>
            <dd className="tabular-nums">{formatCents(receipt.paidThroughCents)}</dd>
          </div>
          <div className="flex justify-between border-t border-line pt-1 font-extrabold text-navy">
            <dt>{receipt.paidInFull ? "Balance" : "Balance remaining"}</dt>
            <dd className="tabular-nums" data-testid="receipt-balance">
              {receipt.paidInFull ? "$0.00 — paid in full" : formatCents(Math.max(0, receipt.balanceAfterCents))}
            </dd>
          </div>
        </dl>

        <p className="mt-8 text-xs text-slate">
          {receipt.paidInFull
            ? `Repairs carry a ${BUSINESS.laborWarrantyMonths}-month labor warranty on the specific work performed. `
            : `The remaining balance can be settled by ${BUSINESS.paymentMethods.join(", ")}. `}
          Thank you for choosing {BUSINESS.shortName}.
        </p>
      </div>
    </>
  );
}
