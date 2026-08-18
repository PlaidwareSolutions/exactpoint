import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import {
  customerAddresses,
  customers,
  estimateItems,
  getDb,
  invoices,
  workOrders,
} from "@exactpoint/db";
import { BUSINESS, formatCents } from "@exactpoint/domain";
import { LogoBadge } from "@/components/brand/logo";
import { InvoiceActions } from "./invoice-actions";

export const dynamic = "force-dynamic";

/** Print-friendly invoice (spec §86). */
export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
  if (!invoice) notFound();
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
  const items = invoice.estimateId
    ? await db
        .select()
        .from(estimateItems)
        .where(eq(estimateItems.estimateId, invoice.estimateId))
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
            className={`mt-1 inline-block rounded-full px-3 py-0.5 text-xs font-bold ${
              invoice.status === "paid"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-point/10 text-point"
            }`}
          >
            {invoice.status.toUpperCase()}
            {invoice.paymentMethod ? ` · ${invoice.paymentMethod}` : ""}
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

      <dl className="ml-auto mt-4 w-56 space-y-1 text-sm">
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
      </dl>

      <p className="mt-8 text-xs text-slate">
        Payment accepted by {BUSINESS.paymentMethods.join(", ")}. Repairs carry a{" "}
        {BUSINESS.laborWarrantyMonths}-month labor warranty on the specific work
        performed. Thank you for choosing {BUSINESS.shortName}.
      </p>
    </div>
    </>
  );
}
