import { notFound } from "next/navigation";
import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import {
  appointments,
  customerAddresses,
  customers,
  equipment,
  getDb,
  invoices,
  serviceRequests,
  serviceTypes,
  workOrders,
} from "@exactpoint/db";
import { BUSINESS, formatCents } from "@exactpoint/domain";
import { EditCustomerForm } from "./edit-customer-form";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS.timezone,
  month: "short",
  day: "numeric",
  year: "numeric",
});

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const [customer] = await db.select().from(customers).where(eq(customers.id, id));
  if (!customer) notFound();

  const [addresses, equipmentRows, requests, orders] = await Promise.all([
    db.select().from(customerAddresses).where(eq(customerAddresses.customerId, id)),
    db.select().from(equipment).where(eq(equipment.customerId, id)),
    db
      .select()
      .from(serviceRequests)
      .where(eq(serviceRequests.customerId, id))
      .orderBy(desc(serviceRequests.createdAt)),
    db
      .select({
        id: workOrders.id,
        status: workOrders.status,
        createdAt: workOrders.createdAt,
        serviceName: serviceTypes.name,
      })
      .from(workOrders)
      .leftJoin(serviceTypes, eq(workOrders.serviceTypeId, serviceTypes.id))
      .where(eq(workOrders.customerId, id))
      .orderBy(desc(workOrders.createdAt)),
  ]);

  const orderIds = orders.map((o) => o.id);
  const [appts, invoiceRows] =
    orderIds.length > 0
      ? await Promise.all([
          db
            .select({
              id: appointments.id,
              workOrderId: appointments.workOrderId,
              windowStart: appointments.windowStart,
              status: appointments.status,
            })
            .from(appointments)
            .where(inArray(appointments.workOrderId, orderIds))
            .orderBy(desc(appointments.windowStart)),
          db
            .select()
            .from(invoices)
            .where(inArray(invoices.workOrderId, orderIds))
            .orderBy(desc(invoices.createdAt)),
        ])
      : [[], []];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-navy">
          {customer.firstName} {customer.lastName}
        </h1>
        <EditCustomerForm
          customerId={id}
          initial={{
            firstName: customer.firstName,
            lastName: customer.lastName,
            phone: customer.phone ?? "",
            email: customer.email ?? "",
            notes: customer.notes ?? "",
          }}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-line bg-white p-5 text-sm">
          <h2 className="font-bold text-navy">Contact</h2>
          <p className="mt-2">
            <a href={`tel:${customer.phone}`} className="font-semibold text-navy">
              {customer.phone}
            </a>
            {customer.email && (
              <>
                <span className="mx-2 text-line">·</span>
                <span className="text-slate">{customer.email}</span>
              </>
            )}
          </p>
          {customer.notes && (
            <p className="mt-2 rounded-lg bg-mist p-3 text-slate">{customer.notes}</p>
          )}
          <h2 className="mt-4 font-bold text-navy">Addresses</h2>
          <ul className="mt-2 space-y-1 text-slate">
            {addresses.map((a) => (
              <li key={a.id}>
                {a.street}
                {a.unit ? `, ${a.unit}` : ""}, {a.city}, {a.state} {a.zip}
              </li>
            ))}
          </ul>
          {equipmentRows.length > 0 && (
            <>
              <h2 className="mt-4 font-bold text-navy">Equipment</h2>
              <ul className="mt-2 space-y-1 text-slate">
                {equipmentRows.map((e) => (
                  <li key={e.id}>
                    {e.brand} {e.model} {e.serial ? `(SN ${e.serial})` : ""}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="rounded-xl border border-line bg-white p-5 text-sm">
          <h2 className="font-bold text-navy">Requests</h2>
          <ul className="mt-2 divide-y divide-line">
            {requests.map((r) => (
              <li key={r.id} className="flex justify-between py-2">
                <Link
                  href={`/manager/requests/${r.id}`}
                  className="font-semibold text-navy hover:text-point"
                >
                  {r.reference}
                </Link>
                <span className="text-slate">{r.status}</span>
              </li>
            ))}
            {requests.length === 0 && <li className="py-2 text-slate">No requests yet.</li>}
          </ul>
        </section>
      </div>

      <section className="rounded-xl border border-line bg-white p-5 text-sm">
        <h2 className="font-bold text-navy">Jobs &amp; invoices</h2>
        {orders.length === 0 && <p className="mt-2 text-slate">No jobs yet.</p>}
        <ul className="mt-2 divide-y divide-line">
          {orders.map((order) => {
            const orderAppts = appts.filter((a) => a.workOrderId === order.id);
            const orderInvoices = invoiceRows.filter((inv) => inv.workOrderId === order.id);
            return (
              <li key={order.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-navy">
                    {order.serviceName ?? "Service"}{" "}
                    <span className="font-normal text-slate">
                      · {dateFmt.format(order.createdAt)}
                    </span>
                  </span>
                  <span className="rounded-full bg-mist px-2 py-0.5 text-xs font-semibold text-slate">
                    {order.status.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {orderAppts.map((a) => (
                    <Link
                      key={a.id}
                      href={`/manager/jobs/${a.id}`}
                      className="rounded-lg border border-line px-3 py-1.5 text-xs font-bold text-navy hover:border-point"
                    >
                      Open job · {dateFmt.format(a.windowStart)} ({a.status.replace(/_/g, " ")})
                    </Link>
                  ))}
                  {orderInvoices.map((inv) => (
                    <Link
                      key={inv.id}
                      href={`/manager/invoices/${inv.id}`}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                        inv.status === "paid"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-point/10 text-point"
                      }`}
                    >
                      {inv.number} · {formatCents(inv.totalCents)} · {inv.status}
                    </Link>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
        {invoiceRows.length > 0 && (
          <p className="mt-3 text-xs text-slate">
            Open an invoice to print it or email it to the customer.
          </p>
        )}
      </section>
    </div>
  );
}
