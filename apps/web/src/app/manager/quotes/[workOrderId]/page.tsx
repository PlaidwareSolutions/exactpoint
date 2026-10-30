import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import {
  billingForWorkOrder,
  customerAddresses,
  customers,
  getDb,
  workOrders,
} from "@exactpoint/db";
import { BillingPanel } from "../../jobs/[id]/billing-panel";
import { toBillingData } from "@/lib/manager/billing-data";

export const metadata = { title: "Quote" };
export const dynamic = "force-dynamic";

/**
 * Quote-first flow: price a job for a customer before anything is scheduled.
 * Same billing panel as the job page, keyed by work order.
 */
export default async function QuotePage({
  params,
}: {
  params: Promise<{ workOrderId: string }>;
}) {
  const { workOrderId } = await params;
  const db = getDb();
  const [order] = await db
    .select({
      id: workOrders.id,
      customerId: customers.id,
      customerFirst: customers.firstName,
      customerLast: customers.lastName,
      phone: customers.phone,
      email: customers.email,
      street: customerAddresses.street,
      city: customerAddresses.city,
      zip: customerAddresses.zip,
    })
    .from(workOrders)
    .innerJoin(customers, eq(workOrders.customerId, customers.id))
    .innerJoin(customerAddresses, eq(workOrders.addressId, customerAddresses.id))
    .where(eq(workOrders.id, workOrderId));
  if (!order) notFound();
  const billing = await billingForWorkOrder(db, workOrderId);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold text-navy">
          Quote for{" "}
          <Link href={`/manager/customers/${order.customerId}`} className="hover:text-point">
            {order.customerFirst} {order.customerLast}
          </Link>
        </h1>
        <p className="mt-1 text-sm text-slate">
          {order.street}, {order.city} {order.zip} ·{" "}
          <a href={`tel:${order.phone}`} className="font-semibold text-navy">
            {order.phone}
          </a>
          {order.email ? ` · ${order.email}` : " · no email on file"}
        </p>
      </div>

      <BillingPanel data={toBillingData(order.id, billing)} />

      <p className="rounded-xl border border-line bg-white px-4 py-3 text-sm text-slate">
        When the customer is ready to book the visit, use{" "}
        <Link href="/manager/new-booking" className="font-semibold text-point">
          ＋ New Booking
        </Link>{" "}
        — their details will come up by phone number.
      </p>
    </div>
  );
}
