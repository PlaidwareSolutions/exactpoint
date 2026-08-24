import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { customers, getDb, invoices, workOrders } from "@exactpoint/db";
import { formatCents } from "@exactpoint/domain";

export const metadata = { title: "Invoices" };
export const dynamic = "force-dynamic";

const STATUSES = ["all", "unpaid", "paid", "void"] as const;

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
      paymentMethod: invoices.paymentMethod,
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

  const outstanding = rows
    .filter((r) => r.status === "unpaid")
    .reduce((sum, r) => sum + r.totalCents, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-extrabold text-navy">Invoices</h1>
        {status !== "paid" && outstanding > 0 && (
          <p className="text-sm font-semibold text-slate">
            Outstanding: <span className="text-point">{formatCents(outstanding)}</span>
          </p>
        )}
      </div>
      <div className="flex gap-2">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/manager/invoices?status=${s}`}
            className={`rounded-full px-3 py-1 text-sm font-semibold ${
              s === status ? "bg-navy text-white" : "bg-white text-slate hover:text-navy"
            }`}
          >
            {s}
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
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-mist">
                <td className="px-4 py-3 font-bold text-navy">
                  <Link href={`/manager/invoices/${r.id}`}>{r.number}</Link>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/manager/customers/${r.customerId}`} className="hover:text-point">
                    {r.customerFirst} {r.customerLast}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate">
                  {r.createdAt.toISOString().slice(0, 10)}
                </td>
                <td className="px-4 py-3 tabular-nums">{formatCents(r.totalCents)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                      r.status === "paid"
                        ? "bg-emerald-50 text-emerald-700"
                        : r.status === "void"
                          ? "bg-mist text-slate"
                          : "bg-point/10 text-point"
                    }`}
                  >
                    {r.status}
                    {r.paymentMethod ? ` · ${r.paymentMethod}` : ""}
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate">
                  No {status === "all" ? "" : status} invoices yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
