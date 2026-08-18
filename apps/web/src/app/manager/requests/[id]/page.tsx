import Link from "next/link";
import { notFound } from "next/navigation";
import { activeWarrantiesForCustomer, getDb } from "@exactpoint/db";
import { serviceRequestDetail } from "@/lib/manager/queries";
import { recommendationsForRequest } from "@/lib/manager/recommendations";
import { activeTechnicians } from "@/lib/manager/queries";
import { AssignPanel } from "./assign-panel";

export const dynamic = "force-dynamic";

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await serviceRequestDetail(id);
  if (!detail) notFound();
  const { request, customer, address, serviceType, photos } = detail;
  const recs = await recommendationsForRequest(id);
  const team = await activeTechnicians();
  const activeWarranties = customer
    ? await activeWarrantiesForCustomer(getDb(), customer.id)
    : [];

  const preferred = Array.isArray(request.preferredWindows)
    ? (request.preferredWindows as { label?: string }[])
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold text-navy">
          {request.reference}
          {request.urgency === "emergency" && (
            <span className="ml-3 rounded-full bg-point/10 px-3 py-1 align-middle text-sm font-bold text-point">
              EMERGENCY
            </span>
          )}
        </h1>
        <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate">
          {request.status}
        </span>
      </div>

      {activeWarranties.length > 0 && (
        <div className="rounded-xl border-2 border-point bg-point/5 p-4 text-sm">
          <p className="font-bold text-point">Possible warranty callback</p>
          <p className="mt-1 text-navy">
            This customer has {activeWarranties.length} active labor{" "}
            {activeWarranties.length === 1 ? "warranty" : "warranties"}:
            {activeWarranties.map((w) => (
              <span key={w.id} className="block text-slate">
                • {w.issueRepaired} (through {w.endDate})
              </span>
            ))}
          </p>
          <p className="mt-1 text-xs text-slate">
            You decide whether this issue qualifies — unrelated failures are
            separate problems (spec §41).
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-line bg-white p-5">
          <h2 className="font-bold text-navy">Request</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-slate">Service</dt>
              <dd className="font-semibold text-navy">
                {serviceType?.name ?? request.serviceOther ?? "Other"}
              </dd>
            </div>
            <div>
              <dt className="text-slate">Problem</dt>
              <dd className="mt-1 rounded-lg bg-mist p-3 text-navy">
                {request.problemDescription}
              </dd>
            </div>
            {(request.equipmentBrand || request.equipmentModel || request.errorCode) && (
              <div className="flex flex-wrap gap-3 text-slate">
                {request.equipmentBrand && <span>Brand: <strong className="text-navy">{request.equipmentBrand}</strong></span>}
                {request.equipmentModel && <span>Model: <strong className="text-navy">{request.equipmentModel}</strong></span>}
                {request.equipmentSerial && <span>Serial: <strong className="text-navy">{request.equipmentSerial}</strong></span>}
                {request.errorCode && <span>Error: <strong className="text-navy">{request.errorCode}</strong></span>}
              </div>
            )}
            {preferred.length > 0 && (
              <div>
                <dt className="text-slate">Customer-preferred windows</dt>
                <dd className="mt-1 flex flex-wrap gap-2">
                  {preferred.map((w, i) => (
                    <span key={i} className="rounded-full bg-mist px-3 py-1 text-xs font-semibold text-navy">
                      {w.label ?? "window"}
                    </span>
                  ))}
                </dd>
              </div>
            )}
          </dl>
          {photos.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-bold text-navy">Photos</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {photos.map((p) => (
                  <img
                    key={p.id}
                    src={`/api/media/${p.id}`}
                    alt="Customer-provided problem photo"
                    className="size-24 rounded-lg border border-line object-cover"
                  />
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-line bg-white p-5">
          <h2 className="font-bold text-navy">Customer</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-slate">Name</dt>
              <dd className="font-semibold text-navy">
                <Link href={`/manager/customers/${customer?.id}`} className="hover:text-point">
                  {customer?.firstName} {customer?.lastName}
                </Link>
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate">Phone</dt>
              <dd className="font-semibold text-navy">
                <a href={`tel:${customer?.phone}`}>{customer?.phone}</a>
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate">Email</dt>
              <dd className="text-navy">{customer?.email}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate">Address</dt>
              <dd className="text-right text-navy">
                {address?.street}
                {address?.unit ? `, ${address.unit}` : ""}
                <br />
                {address?.city}, {address?.state} {address?.zip}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate">Zone</dt>
              <dd className="font-semibold text-navy">{address?.zoneName ?? "Outside configured zones"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate">Address check</dt>
              <dd className="text-navy">{address?.validationStatus}</dd>
            </div>
          </dl>
        </section>
      </div>

      <AssignPanel
        requestId={id}
        requestStatus={request.status}
        jobHref={
          detail.relatedAppointmentId ? `/manager/jobs/${detail.relatedAppointmentId}` : null
        }
        recommendations={recs?.recommendations ?? []}
        durationMinutes={recs?.serviceDuration ?? 90}
        technicians={team
          .filter((t) => t.isActive)
          .map((t) => ({ id: t.id, name: `${t.firstName} ${t.lastName}`.trim() }))}
      />
    </div>
  );
}
