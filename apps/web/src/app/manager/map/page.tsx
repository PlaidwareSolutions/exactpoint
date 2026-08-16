import Link from "next/link";
import { addDays } from "@exactpoint/scheduling";
import {
  activeTechnicians,
  appointmentsForDay,
  todayYmd,
  unassignedWork,
} from "@/lib/manager/queries";
import { DayMap } from "./day-map";

export const metadata = { title: "Map" };
export const dynamic = "force-dynamic";

/** §20 map view: markers, technician routes, sequence, unassigned jobs. */
export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const ymd = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? "") ? params.date! : todayYmd();
  const [team, appts, queue] = await Promise.all([
    activeTechnicians(),
    appointmentsForDay(ymd),
    unassignedWork(),
  ]);

  const located = appts.filter(
    (a) =>
      a.technicianId &&
      a.latitude != null &&
      a.longitude != null &&
      !["cancelled", "customer_declined", "no_show"].includes(a.status),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-navy">Map</h1>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Link href={`/manager/map?date=${addDays(ymd, -1)}`} className="rounded-lg border border-line bg-white px-3 py-1.5 hover:border-point">←</Link>
          <span className="rounded-lg bg-white px-3 py-1.5 tabular-nums text-navy">{ymd}</span>
          <Link href={`/manager/map?date=${addDays(ymd, 1)}`} className="rounded-lg border border-line bg-white px-3 py-1.5 hover:border-point">→</Link>
        </div>
      </div>

      <DayMap
        stops={located.map((a) => ({
          appointmentId: a.appointmentId,
          technicianId: a.technicianId!,
          lat: a.latitude!,
          lng: a.longitude!,
          startIso: a.scheduledStart?.toISOString() ?? a.windowStart.toISOString(),
          label: `${a.serviceName ?? "Service"} · ${a.customerFirst} ${a.customerLast}`,
          sub: `${a.city}${a.zoneName ? ` · ${a.zoneName}` : ""} · ${a.status.replace(/_/g, " ")}`,
        }))}
        technicians={team
          .filter((t) => t.isActive)
          .map((t) => ({
            id: t.id,
            name: `${t.firstName} ${t.lastName}`.trim(),
            color: t.color ?? "#94a3b8",
          }))}
      />

      {queue.newRequests.length > 0 && (
        <section className="rounded-xl border border-line bg-white p-4 text-sm">
          <h2 className="font-bold text-navy">Unassigned requests</h2>
          <ul className="mt-2 space-y-1">
            {queue.newRequests.slice(0, 6).map((r) => (
              <li key={r.id}>
                <Link href={`/manager/requests/${r.id}`} className="text-navy hover:text-point">
                  {r.reference} · {r.serviceName ?? r.serviceOther ?? "Service"} ·{" "}
                  {r.zoneName ?? r.city}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
