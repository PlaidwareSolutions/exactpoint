import Link from "next/link";
import { notFound } from "next/navigation";
import { appointmentDetail, billingForWorkOrder, getDb } from "@exactpoint/db";
import { BUSINESS } from "@exactpoint/domain";
import { BillingPanel } from "./billing-panel";
import { StatusControls } from "./status-controls";

export const dynamic = "force-dynamic";

const fmt = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS.timezone,
  weekday: "short",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export default async function ManagerJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const job = await appointmentDetail(db, id);
  if (!job) notFound();
  const billing = await billingForWorkOrder(db, job.workOrderId);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-navy">
          {job.serviceName ?? "Service"} · {job.customerFirst} {job.customerLast}
        </h1>
        <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate">
          {job.status.replace(/_/g, " ")}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-line bg-white p-5 text-sm">
          <h2 className="font-bold text-navy">Visit</h2>
          <dl className="mt-3 space-y-2">
            <div className="flex justify-between gap-3">
              <dt className="text-slate">Window</dt>
              <dd className="font-semibold text-navy">
                {fmt.format(job.windowStart)} – {fmt.format(job.windowEnd)}
              </dd>
            </div>
            {job.assignments.map((a) => (
              <div key={a.technicianId} className="flex justify-between gap-3">
                <dt className="text-slate">{a.role === "lead" ? "Technician" : "Helper"}</dt>
                <dd className="flex items-center gap-2 font-semibold text-navy">
                  <span className="size-2.5 rounded-full" style={{ background: a.color ?? "#94a3b8" }} />
                  {a.firstName} {a.lastName} · {fmt.format(a.scheduledStart)}
                </dd>
              </div>
            ))}
            <div className="flex justify-between gap-3">
              <dt className="text-slate">Customer</dt>
              <dd className="font-semibold text-navy">
                <Link href={`/manager/customers/${job.customerId}`} className="hover:text-point">
                  {job.customerFirst} {job.customerLast}
                </Link>{" "}
                · <a href={`tel:${job.customerPhone}`}>{job.customerPhone}</a>
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate">Address</dt>
              <dd className="text-right text-navy">
                {job.street}
                {job.unit ? `, ${job.unit}` : ""}, {job.city} {job.zip}
              </dd>
            </div>
          </dl>
          {job.history.length > 0 && (
            <p className="mt-3 text-xs text-slate">
              History: {job.history.map((h) => h.toStatus.replace(/_/g, " ")).join(" → ")}
            </p>
          )}
        </section>

        <section className="rounded-xl border border-line bg-white p-5 text-sm">
          <h2 className="font-bold text-navy">Warranty</h2>
          {job.warranties.length === 0 ? (
            <p className="mt-2 text-slate">
              No warranty yet — one is recorded automatically when the job is
              completed.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {job.warranties.map((w) => (
                <li key={w.id} className="rounded-lg bg-mist p-3">
                  <p className="font-semibold text-navy">{w.issueRepaired}</p>
                  {w.componentRepaired && <p className="text-slate">{w.componentRepaired}</p>}
                  <p className="text-xs text-slate">
                    Labor warranty {w.startDate} → {w.endDate}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <h2 className="mt-4 font-bold text-navy">Notes</h2>
          <ul className="mt-2 space-y-2">
            {job.notes.map((n) => (
              <li key={n.id} className="rounded-lg bg-mist p-3 text-navy">
                {n.body}
              </li>
            ))}
            {job.notes.length === 0 && <li className="text-slate">No notes.</li>}
          </ul>

          {job.photos.length > 0 && (
            <>
              <h2 className="mt-4 font-bold text-navy">Photos</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {job.photos.map((p) => (
                  <a key={p.id} href={`/api/media/${p.id}`} target="_blank" rel="noreferrer">
                    <img
                      src={`/api/media/${p.id}`}
                      alt={p.category.replace(/_/g, " ")}
                      className="size-20 rounded-lg border border-line object-cover"
                    />
                  </a>
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      <BillingPanel
        data={{
          workOrderId: job.workOrderId,
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
        }}
      />

      <StatusControls appointmentId={job.appointmentId} status={job.status} />
    </div>
  );
}
