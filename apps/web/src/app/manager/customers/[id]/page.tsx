import { notFound } from "next/navigation";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import {
  appointments,
  customerAddresses,
  customers,
  equipment,
  getDb,
  serviceRequests,
  serviceTypes,
  workOrders,
} from "@exactpoint/db";

export const dynamic = "force-dynamic";

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

  const appts =
    orders.length > 0
      ? await db
          .select()
          .from(appointments)
          .where(eq(appointments.workOrderId, orders[0]!.id))
      : [];

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold text-navy">
        {customer.firstName} {customer.lastName}
      </h1>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-line bg-white p-5 text-sm">
          <h2 className="font-bold text-navy">Contact</h2>
          <p className="mt-2">
            <a href={`tel:${customer.phone}`} className="font-semibold text-navy">
              {customer.phone}
            </a>
            <span className="mx-2 text-line">·</span>
            <span className="text-slate">{customer.email}</span>
          </p>
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
          <h2 className="font-bold text-navy">Service history</h2>
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
          {appts.length > 0 && (
            <p className="mt-3 text-xs text-slate">
              {orders.length} work order(s), latest with {appts.length} visit(s).
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
