import Link from "next/link";
import {
  activeTechnicians,
  appointmentsForDay,
  todayYmd,
  unassignedWork,
} from "@/lib/manager/queries";

export const metadata = { title: "Today" };
export const dynamic = "force-dynamic";

function Stat({ label, value, tone }: { label: string; value: number; tone?: "alert" }) {
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <p className={`text-3xl font-extrabold ${tone === "alert" && value > 0 ? "text-point" : "text-navy"}`}>
        {value}
      </p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate">{label}</p>
    </div>
  );
}

export default async function TodayPage() {
  const ymd = todayYmd();
  const [appts, team, queue] = await Promise.all([
    appointmentsForDay(ymd),
    activeTechnicians(),
    unassignedWork(),
  ]);

  const inProgress = appts.filter((a) =>
    ["en_route", "arrived", "in_progress"].includes(a.status),
  ).length;
  const working = new Set(appts.map((a) => a.technicianId).filter(Boolean)).size;
  const zones = [...new Set(appts.map((a) => a.zoneName).filter(Boolean))] as string[];
  const emergencies = queue.newRequests.filter((r) => r.urgency === "emergency");

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-extrabold text-navy">Today</h1>
        <p className="text-sm text-slate">{ymd}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Appointments" value={appts.length} />
        <Stat label="In progress" value={inProgress} />
        <Stat label="Techs working" value={working} />
        <Stat label="New requests" value={queue.newRequests.length} tone="alert" />
        <Stat label="Emergencies" value={emergencies.length} tone="alert" />
        <Stat
          label="Needs reassignment"
          value={queue.orphanedFuture.length + queue.unassignedAppointments.length}
          tone="alert"
        />
      </div>

      {zones.length > 0 && (
        <p className="text-sm text-slate">
          Today&apos;s zones:{" "}
          <span className="font-semibold text-navy">{zones.join(" · ")}</span>
        </p>
      )}

      {(queue.newRequests.length > 0 ||
        queue.orphanedFuture.length > 0 ||
        queue.unassignedAppointments.length > 0) && (
        <section className="rounded-xl border border-line bg-white">
          <h2 className="border-b border-line px-4 py-3 font-bold text-navy">
            Needs attention
          </h2>
          <ul className="divide-y divide-line">
            {queue.newRequests.slice(0, 8).map((r) => (
              <li key={r.id}>
                <Link
                  href={`/manager/requests/${r.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-mist"
                >
                  <span>
                    <span className="font-bold text-navy">{r.reference}</span>{" "}
                    <span className="text-slate">
                      {r.serviceName ?? r.serviceOther ?? "Service"} · {r.customerFirst}{" "}
                      {r.customerLast} · {r.city}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    {r.urgency === "emergency" && (
                      <span className="rounded-full bg-point/10 px-2 py-0.5 text-xs font-bold text-point">
                        EMERGENCY
                      </span>
                    )}
                    <span className="text-xs font-semibold text-point">Schedule →</span>
                  </span>
                </Link>
              </li>
            ))}
            {queue.orphanedFuture.map((o) => (
              <li key={o.appointmentId} className="px-4 py-3 text-sm text-slate">
                <span className="font-semibold text-red-700">Reassign:</span>{" "}
                {o.customerFirst} {o.customerLast} ({o.serviceName ?? "Service"}) is
                assigned to deactivated technician {o.technicianFirst} {o.technicianLast} —{" "}
                <Link href="/manager/calendar" className="font-semibold text-point">
                  open calendar
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl border border-line bg-white">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="font-bold text-navy">Today&apos;s schedule</h2>
          <Link href="/manager/calendar" className="text-sm font-semibold text-point">
            Full calendar →
          </Link>
        </div>
        {appts.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate">No appointments today.</p>
        ) : (
          <ul className="divide-y divide-line">
            {appts.map((a) => {
              const tech = team.find((t) => t.id === a.technicianId);
              return (
                <li key={`${a.appointmentId}-${a.technicianId}`} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ background: tech?.color ?? "#94a3b8" }}
                  />
                  <span className="w-28 shrink-0 font-semibold tabular-nums text-navy">
                    {a.scheduledStart
                      ? new Intl.DateTimeFormat("en-US", {
                          timeZone: "America/Chicago",
                          hour: "numeric",
                          minute: "2-digit",
                        }).format(a.scheduledStart)
                      : "—"}
                  </span>
                  <span className="flex-1 text-navy">
                    {a.serviceName ?? "Service"} · {a.customerFirst} {a.customerLast} ·{" "}
                    <span className="text-slate">{a.city}</span>
                  </span>
                  <span className="hidden text-slate sm:block">
                    {tech ? `${tech.firstName} ${tech.lastName}` : "Unassigned"}
                  </span>
                  <span className="rounded-full bg-mist px-2 py-0.5 text-xs font-semibold text-slate">
                    {a.status.replace(/_/g, " ")}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
