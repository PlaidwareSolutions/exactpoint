import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { dailyRoutes, getDb } from "@exactpoint/db";
import { BUSINESS } from "@exactpoint/domain";
import {
  addDays,
  recommendStopOrder,
  routeTravel,
  type RouteStopInput,
} from "@exactpoint/scheduling";
import { estimateTravelMinutes } from "@/lib/scheduling-server";
import { activeTechnicians, appointmentsForDay, todayYmd } from "@/lib/manager/queries";
import { AcceptRouteButton } from "./accept-button";

export const metadata = { title: "Routes" };
export const dynamic = "force-dynamic";

const timeFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS.timezone,
  hour: "numeric",
  minute: "2-digit",
});

/** Daily routes + Optimize Day (spec §75). Windows are never moved. */
export default async function RoutesPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const ymd = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? "") ? params.date! : todayYmd();
  const db = getDb();
  const [team, appts] = await Promise.all([activeTechnicians(), appointmentsForDay(ymd)]);
  const approvedRoutes = await db
    .select()
    .from(dailyRoutes)
    .where(and(eq(dailyRoutes.routeDate, ymd)));

  const sections = team
    .filter((t) => t.isActive)
    .map((tech) => {
      const jobs = appts.filter(
        (a) =>
          a.technicianId === tech.id &&
          a.scheduledStart &&
          !["cancelled", "customer_declined", "no_show"].includes(a.status),
      );
      const byId = new Map(jobs.map((j) => [j.appointmentId, j]));
      const stops: RouteStopInput[] = jobs.map((j) => ({
        appointmentId: j.appointmentId,
        start: j.scheduledStart!,
        location:
          j.latitude != null && j.longitude != null
            ? { latitude: j.latitude, longitude: j.longitude }
            : null,
      }));
      const current = routeTravel(
        [...stops].sort((a, b) => a.start.getTime() - b.start.getTime()),
        estimateTravelMinutes,
      );
      const recommended = recommendStopOrder(stops, estimateTravelMinutes);
      const savings = current.totalTravelMinutes - recommended.totalTravelMinutes;
      const approved = approvedRoutes.find((r) => r.technicianId === tech.id);
      return { tech, jobs, byId, current, recommended, savings, approved };
    })
    .filter((s) => s.jobs.length > 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-navy">Routes</h1>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Link href={`/manager/routes?date=${addDays(ymd, -1)}`} className="rounded-lg border border-line bg-white px-3 py-1.5 hover:border-point">←</Link>
          <span className="rounded-lg bg-white px-3 py-1.5 tabular-nums text-navy">{ymd}</span>
          <Link href={`/manager/routes?date=${addDays(ymd, 1)}`} className="rounded-lg border border-line bg-white px-3 py-1.5 hover:border-point">→</Link>
        </div>
      </div>

      {sections.length === 0 && (
        <p className="rounded-xl border border-line bg-white p-6 text-sm text-slate">
          No assigned jobs on this day.
        </p>
      )}

      {sections.map(({ tech, byId, current, recommended, savings, approved }) => (
        <section key={tech.id} className="rounded-xl border border-line bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-bold text-navy">
              <span className="size-3 rounded-full" style={{ background: tech.color ?? "#94a3b8" }} />
              {tech.firstName} {tech.lastName}
              <span className="text-sm font-semibold text-slate">
                · {current.order.length} stops · ≈{current.totalTravelMinutes} min driving
              </span>
            </h2>
            {approved && (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                Route approved (≈{approved.totalTravelMinutes} min)
              </span>
            )}
          </div>

          <ol className="mt-3 space-y-1.5 text-sm">
            {current.order.map((appointmentId, i) => {
              const j = byId.get(appointmentId)!;
              const leg = current.legs.find((l) => l.toId === appointmentId);
              return (
                <li key={appointmentId} className="flex items-center gap-3">
                  <span className="w-6 text-right font-bold tabular-nums text-slate">{i + 1}.</span>
                  <span className="w-20 font-semibold tabular-nums text-navy">
                    {timeFmt.format(j.scheduledStart!)}
                  </span>
                  <Link href={`/manager/jobs/${appointmentId}`} className="flex-1 truncate text-navy hover:text-point">
                    {j.serviceName ?? "Service"} · {j.customerFirst} {j.customerLast} · {j.city}
                  </Link>
                  {leg && <span className="text-xs text-slate">+{leg.minutes} min drive</span>}
                </li>
              );
            })}
          </ol>

          {savings > 5 && !approved && (
            <div className="mt-4 rounded-lg border border-point/40 bg-point/5 p-3 text-sm">
              <p className="font-bold text-point">
                Optimize Day: reordering stops saves ≈{savings} min of driving
              </p>
              <p className="mt-1 text-slate">
                Suggested order:{" "}
                {recommended.order
                  .map((id, i) => `${i + 1}. ${byId.get(id)!.customerFirst} (${byId.get(id)!.city})`)
                  .join(" → ")}
              </p>
              <p className="mt-1 text-xs text-slate">
                Accepting records the visit order for the technician — confirmed
                customer windows are not changed.
              </p>
              <AcceptRouteButton
                technicianId={tech.id}
                routeDate={ymd}
                order={recommended.order.map((id) => ({
                  appointmentId: id,
                  travelMinutesFromPrevious:
                    recommended.legs.find((l) => l.toId === id)?.minutes ?? null,
                }))}
                totalTravelMinutes={recommended.totalTravelMinutes}
              />
            </div>
          )}
          {savings <= 5 && !approved && (
            <p className="mt-3 text-xs text-slate">
              Time order is already efficient — nothing worth reordering.
            </p>
          )}
        </section>
      ))}
    </div>
  );
}
