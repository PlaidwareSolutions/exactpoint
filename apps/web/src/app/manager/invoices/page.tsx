import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { customers, getDb, invoices, paidCentsExpr, workOrders } from "@exactpoint/db";
import { INVOICE_STATUS_LABELS, formatCents } from "@exactpoint/domain";
import { InvoiceStatusChip } from "@/components/billing/payment-ledger";

export const metadata = { title: "Invoices" };
export const dynamic = "force-dynamic";

const STATUSES = ["all", "unpaid", "partially_paid", "paid", "void"] as const;

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const raw = (await searchParams).status;
  const status = (STATUSES as readonly string[]).includes(raw ?? "")
    ? (raw as (typeof STATUSES)[number])
    : "all";

  const rows = await getDb()
    .select({
      id: invoices.id,
      number: invoices.number,
      status: invoices.status,
      totalCents: invoices.totalCents,
      paidCents: paidCentsExpr(invoices.id),
      createdAt: invoices.createdAt,
      customerFirst: customers.firstName,
      customerLast: customers.lastName,
      customerId: customers.id,
    })
    .from(invoices)
    .innerJoin(workOrders, eq(invoices.workOrderId, workOrders.id))
    .innerJoin(customers, eq(workOrders.customerId, customers.id))
    .where(status === "all" ? undefined : eq(invoices.status, status))
    .orderBy(desc(invoices.createdAt))
    .limit(200);

  // Outstanding = what is still owed, so a half-paid invoice counts its balance only.
  const outstanding = rows
    .filter((r) => r.status === "unpaid" || r.status === "partially_paid")
    .reduce((sum, r) => sum + Math.max(0, r.totalCents - r.paidCents), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-extrabold text-navy">Invoices</h1>
        {status !== "paid" && status !== "void" && outstanding > 0 && (
          <p className="text-sm font-semibold text-slate" data-testid="outstanding-total">
            Outstanding: <span className="text-point">{formatCents(outstanding)}</span>
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/manager/invoices?status=${s}`}
            className={`rounded-full px-3 py-1 text-sm font-semibold ${
              s === status ? "bg-navy text-white" : "bg-white text-slate hover:text-navy"
            }`}
          >
            {s === "all" ? "all" : (INVOICE_STATUS_LABELS[s] ?? s).toLowerCase()}
          </Link>
        ))}
      </div>
      <div className="overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wider text-slate">
            <tr>
              <th className="px-4 py-3">Invoice</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Paid</th>
              <th className="px-4 py-3 text-right">Balance</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => {
              const balance = Math.max(0, r.totalCents - r.paidCents);
              return (
                <tr key={r.id} className="hover:bg-mist">
                  <td className="px-4 py-3 font-bold text-navy">
                    <Link href={`/manager/invoices/${r.id}`}>{r.number}</Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/manager/customers/${r.customerId}`} className="hover:text-point">
                      {r.customerFirst} {r.customerLast}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate">{r.createdAt.toISOString().slice(0, 10)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCents(r.totalCents)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate">{formatCents(r.paidCents)}</td>
                  <td
                    className={`px-4 py-3 text-right font-semibold tabular-nums ${
                      balance > 0 && r.status !== "void" ? "text-point" : "text-slate"
                    }`}
                  >
                    {r.status === "void" ? "—" : formatCents(balance)}
                  </td>
                  <td className="px-4 py-3">
                    <InvoiceStatusChip status={r.status} className="!px-2 !py-0.5" />
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate">
                  No {status === "all" ? "" : (INVOICE_STATUS_LABELS[status] ?? status).toLowerCase()} invoices yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
