import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import {
  customerAddresses,
  customers,
  estimateRevisions,
  getDb,
  invoiceLedger,
  workOrders,
} from "@exactpoint/db";
import { BUSINESS, INVOICE_STATUS_LABELS, PAYMENT_METHOD_LABELS, formatCents } from "@exactpoint/domain";
import { LogoBadge } from "@/components/brand/logo";
import { PaymentLedger, STATUS_TONE } from "@/components/billing/payment-ledger";
import { toLedgerInvoice } from "@/lib/manager/billing-data";
import { InvoiceActions } from "./invoice-actions";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS.timezone,
  month: "short",
  day: "numeric",
  year: "numeric",
});

/** Print-friendly invoice with its payments ledger (spec §42, §86). */
export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const ledger = await invoiceLedger(db, id);
  if (!ledger) notFound();
  const { invoice, items, payments, paidCents, balanceCents } = ledger;
  const [order] = await db
    .select({
      customerFirst: customers.firstName,
      customerLast: customers.lastName,
      customerPhone: customers.phone,
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
  const [revision] = invoice.estimateRevisionId
    ? await db
        .select({ revision: estimateRevisions.revision, kind: estimateRevisions.kind })
        .from(estimateRevisions)
        .where(eq(estimateRevisions.id, invoice.estimateRevisionId))
    : [];

  return (
    <>
      <InvoiceActions invoiceId={invoice.id} customerEmail={order?.customerEmail ?? null} />
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
            <p className="text-xl font-extrabold text-navy">{invoice.number}</p>
            <p className="text-xs text-slate">{invoice.createdAt.toISOString().slice(0, 10)}</p>
            <p
              className={`mt-1 inline-block rounded-full px-3 py-0.5 text-xs font-bold ${STATUS_TONE[invoice.status] ?? STATUS_TONE.unpaid}`}
              data-testid="invoice-status"
            >
              {(INVOICE_STATUS_LABELS[invoice.status] ?? invoice.status).toUpperCase()}
            </p>
          </div>
        </header>

        {order && (
          <p className="mt-6 text-sm text-slate">
            Billed to:{" "}
            <span className="font-semibold text-navy">
              {order.customerFirst} {order.customerLast}
            </span>
            , {order.street}
            {order.unit ? `, ${order.unit}` : ""}, {order.city}, {order.state} {order.zip}
          </p>
        )}
        {revision && revision.revision > 1 && (
          <p className="mt-1 text-xs text-slate">
            Per approved quote revision {revision.revision}
            {revision.kind === "change_order" ? " (change order)" : ""}.
          </p>
        )}

        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-slate">
              <th className="py-2">Description</th>
              <th className="py-2 text-right">Qty</th>
              <th className="py-2 text-right">Unit</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {invoice.diagnosticFeeCents > 0 && (
              <tr>
                <td className="py-2 text-navy">Diagnostic / service-call fee</td>
                <td className="py-2 text-right tabular-nums">1</td>
                <td className="py-2 text-right tabular-nums">{formatCents(invoice.diagnosticFeeCents)}</td>
                <td className="py-2 text-right tabular-nums">{formatCents(invoice.diagnosticFeeCents)}</td>
              </tr>
            )}
            {invoice.subtotalCents > 0 &&
              items.map((item) => (
                <tr key={item.id}>
                  <td className="py-2 text-navy">{item.description}</td>
                  <td className="py-2 text-right tabular-nums">{item.quantity}</td>
                  <td className="py-2 text-right tabular-nums">{formatCents(item.unitPriceCents)}</td>
                  <td className="py-2 text-right tabular-nums">
                    {formatCents(item.quantity * item.unitPriceCents)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>

        <dl className="ml-auto mt-4 w-64 space-y-1 text-sm">
          {invoice.subtotalCents > 0 && (
            <>
              <div className="flex justify-between text-slate">
                <dt>Subtotal</dt>
                <dd className="tabular-nums">{formatCents(invoice.subtotalCents)}</dd>
              </div>
              <div className="flex justify-between text-slate">
                <dt>Tax</dt>
                <dd className="tabular-nums">{formatCents(invoice.taxCents)}</dd>
              </div>
              <div className="flex justify-between text-slate">
                <dt>Diagnostic fee</dt>
                <dd className="tabular-nums">Waived</dd>
              </div>
            </>
          )}
          <div className="flex justify-between border-t border-line pt-1 font-extrabold text-navy">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatCents(invoice.totalCents)}</dd>
          </div>
          {paidCents > 0 && (
            <div className="flex justify-between text-slate">
              <dt>Paid to date</dt>
              <dd className="tabular-nums">{formatCents(paidCents)}</dd>
            </div>
          )}
          <div className="flex justify-between font-extrabold text-navy">
            <dt>Balance due</dt>
            <dd className="tabular-nums" data-testid="balance-due">
              {balanceCents <= 0 ? "$0.00 — paid in full" : formatCents(balanceCents)}
            </dd>
          </div>
        </dl>

        {payments.length > 0 && (
          <section className="mt-6">
            <h2 className="text-xs uppercase tracking-wider text-slate">Payments received</h2>
            <table className="mt-1 w-full text-sm">
              <tbody className="divide-y divide-line">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="py-1.5 text-slate">{dateFmt.format(p.receivedAt)}</td>
                    <td className="py-1.5 text-navy">
                      {p.kind === "refund" ? "Refund" : "Payment"} · {PAYMENT_METHOD_LABELS[p.method] ?? p.method}
                      {p.reference ? ` · ${p.reference}` : ""}
                    </td>
                    <td className="py-1.5 text-slate">{p.receiptNumber}</td>
                    <td className={`py-1.5 text-right tabular-nums ${p.kind === "refund" ? "text-red-700" : ""}`}>
                      {p.kind === "refund" ? "−" : ""}
                      {formatCents(p.amountCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <p className="mt-8 text-xs text-slate">
          Payment accepted by {BUSINESS.paymentMethods.join(", ")}. Repairs carry a{" "}
          {BUSINESS.laborWarrantyMonths}-month labor warranty on the specific work
          performed. Thank you for choosing {BUSINESS.shortName}.
        </p>
      </div>

      <section className="mx-auto mt-4 max-w-2xl rounded-xl border border-line bg-white p-5 print:hidden">
        <h2 className="mb-3 font-bold text-navy">Payments</h2>
        <PaymentLedger invoice={toLedgerInvoice({ ...invoice, payments, paidCents, balanceCents })} />
      </section>
    </>
  );
}
