import Link from "next/link";
import { desc, eq, ilike, like, or } from "drizzle-orm";
import {
  customers,
  getDb,
  invoices,
  serviceRequests,
  workOrders,
} from "@exactpoint/db";
import { formatCents } from "@exactpoint/domain";

export const metadata = { title: "Search" };
export const dynamic = "force-dynamic";

/** One box finds people, requests, and paperwork. */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const q = ((await searchParams).q ?? "").trim().slice(0, 60);
  const db = getDb();

  const term = `%${q}%`;
  const digits = q.replace(/\D/g, "");

  const [customerHits, requestHits, invoiceHits] = q.length < 2
    ? [[], [], []]
    : await Promise.all([
        db
          .select()
          .from(customers)
          .where(
            or(
              ilike(customers.firstName, term),
              ilike(customers.lastName, term),
              ilike(customers.email, term),
              ...(digits.length >= 4 ? [like(customers.phone, `%${digits}%`)] : []),
            ),
          )
          .orderBy(desc(customers.createdAt))
          .limit(10),
        db
          .select({
            id: serviceRequests.id,
            reference: serviceRequests.reference,
            status: serviceRequests.status,
            problem: serviceRequests.problemDescription,
            customerFirst: customers.firstName,
            customerLast: customers.lastName,
          })
          .from(serviceRequests)
          .innerJoin(customers, eq(serviceRequests.customerId, customers.id))
          .where(ilike(serviceRequests.reference, term))
          .orderBy(desc(serviceRequests.createdAt))
          .limit(10),
        db
          .select({
            id: invoices.id,
            number: invoices.number,
            status: invoices.status,
            totalCents: invoices.totalCents,
            createdAt: invoices.createdAt,
            customerFirst: customers.firstName,
            customerLast: customers.lastName,
          })
          .from(invoices)
          .innerJoin(workOrders, eq(invoices.workOrderId, workOrders.id))
          .innerJoin(customers, eq(workOrders.customerId, customers.id))
          .where(ilike(invoices.number, term))
          .orderBy(desc(invoices.createdAt))
          .limit(10),
      ]);

  const nothing =
    q.length >= 2 &&
    customerHits.length === 0 &&
    requestHits.length === 0 &&
    invoiceHits.length === 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-navy">Search</h1>
      <form action="/manager/search" className="flex max-w-xl gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Name, phone, email, EP-… or INV-…"
          className="w-full rounded-lg border border-line bg-white px-4 py-2.5 text-navy focus:border-point focus:outline-none"
        />
        <button className="rounded-lg bg-point px-5 py-2.5 font-bold text-white hover:bg-point-deep">
          Search
        </button>
      </form>

      {q.length < 2 && (
        <p className="text-sm text-slate">
          Search customers by name, phone, or email — or jump straight to a
          request (EP-1042) or invoice (INV-1017).
        </p>
      )}
      {nothing && <p className="text-sm text-slate">Nothing found for “{q}”.</p>}

      {customerHits.length > 0 && (
        <section className="rounded-xl border border-line bg-white">
          <h2 className="border-b border-line px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-slate">
            Customers
          </h2>
          <ul className="divide-y divide-line">
            {customerHits.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/manager/customers/${c.id}`}
                  className="flex flex-wrap justify-between gap-2 px-4 py-3 text-sm hover:bg-mist"
                >
                  <span className="font-semibold text-navy">
                    {c.firstName} {c.lastName}
                  </span>
                  <span className="text-slate">
                    {c.phone} {c.email ? `· ${c.email}` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {requestHits.length > 0 && (
        <section className="rounded-xl border border-line bg-white">
          <h2 className="border-b border-line px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-slate">
            Requests
          </h2>
          <ul className="divide-y divide-line">
            {requestHits.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/manager/requests/${r.id}`}
                  className="flex flex-wrap justify-between gap-2 px-4 py-3 text-sm hover:bg-mist"
                >
                  <span>
                    <span className="font-bold text-navy">{r.reference}</span>{" "}
                    <span className="text-slate">
                      {r.customerFirst} {r.customerLast} · {r.problem.slice(0, 60)}
                    </span>
                  </span>
                  <span className="rounded-full bg-mist px-2 py-0.5 text-xs font-semibold text-slate">
                    {r.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {invoiceHits.length > 0 && (
        <section className="rounded-xl border border-line bg-white">
          <h2 className="border-b border-line px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-slate">
            Invoices
          </h2>
          <ul className="divide-y divide-line">
            {invoiceHits.map((inv) => (
              <li key={inv.id}>
                <Link
                  href={`/manager/invoices/${inv.id}`}
                  className="flex flex-wrap justify-between gap-2 px-4 py-3 text-sm hover:bg-mist"
                >
                  <span className="font-bold text-navy">
                    {inv.number}{" "}
                    <span className="font-normal text-slate">
                      {inv.customerFirst} {inv.customerLast}
                    </span>
                  </span>
                  <span>
                    <span className="mr-3 tabular-nums text-navy">{formatCents(inv.totalCents)}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                        inv.status === "paid"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-point/10 text-point"
                      }`}
                    >
                      {inv.status}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
