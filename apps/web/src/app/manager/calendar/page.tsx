import Link from "next/link";
import { BUSINESS } from "@exactpoint/domain";
import { addDays, zonedTimeToUtc } from "@exactpoint/scheduling";
import {
  activeTechnicians,
  appointmentsForDay,
  todayYmd,
} from "@/lib/manager/queries";
import { CalendarDay } from "./calendar-day";

export const metadata = { title: "Calendar" };
export const dynamic = "force-dynamic";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; view?: string }>;
}) {
  const params = await searchParams;
  const ymd = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? "") ? params.date! : todayYmd();
  const view = params.view === "week" ? "week" : "day";
  const team = (await activeTechnicians()).filter((t) => t.isActive);

  if (view === "week") {
    const days = [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(ymd, i));
    const perDay = await Promise.all(days.map((d) => appointmentsForDay(d)));
    return (
      <div className="space-y-4">
        <Header ymd={ymd} view={view} />
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wider text-slate">
                <th className="px-3 py-2 text-left">Technician</th>
                {days.map((d) => (
                  <th key={d} className="px-3 py-2 text-center">
                    <Link href={`/manager/calendar?date=${d}`} className="hover:text-point">
                      {d.slice(5)}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {team.map((t) => (
                <tr key={t.id}>
                  <td className="px-3 py-2 font-semibold text-navy">
                    <span className="mr-2 inline-block size-2.5 rounded-full" style={{ background: t.color ?? "#94a3b8" }} />
                    {t.firstName} {t.lastName}
                  </td>
                  {perDay.map((appts, i) => {
                    const mine = appts.filter((a) => a.technicianId === t.id);
                    const zones = [...new Set(mine.map((m) => m.zoneName).filter(Boolean))];
                    return (
                      <td key={days[i]} className="px-3 py-2 text-center align-top">
                        {mine.length > 0 ? (
                          <>
                            <span className="font-bold text-navy">{mine.length}</span>
                            <p className="mt-0.5 text-xs text-slate">{zones.join(", ")}</p>
                          </>
                        ) : (
                          <span className="text-line">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const appts = await appointmentsForDay(ymd);
  const dayStartUtc = zonedTimeToUtc(ymd, "07:00", BUSINESS.timezone);
  return (
    <div className="space-y-4">
      <Header ymd={ymd} view={view} />
      <CalendarDay
        dayStartIso={dayStartUtc.toISOString()}
        technicians={team.map((t) => ({
          id: t.id,
          name: `${t.firstName} ${t.lastName}`.trim(),
          color: t.color ?? "#94a3b8",
        }))}
        appointments={appts
          .filter((a) => a.technicianId && a.scheduledStart && a.scheduledEnd)
          .map((a) => ({
            appointmentId: a.appointmentId,
            technicianId: a.technicianId!,
            startIso: a.scheduledStart!.toISOString(),
            endIso: a.scheduledEnd!.toISOString(),
            durationMinutes: a.durationMinutes,
            label: `${a.serviceName ?? "Service"} · ${a.customerFirst} ${a.customerLast}`,
            sub: `${a.city}${a.zoneName ? ` · ${a.zoneName}` : ""}`,
            status: a.status,
          }))}
      />
    </div>
  );
}

function Header({ ymd, view }: { ymd: string; view: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-extrabold text-navy">Calendar</h1>
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Link href={`/manager/calendar?date=${addDays(ymd, view === "week" ? -7 : -1)}&view=${view}`} className="rounded-lg border border-line bg-white px-3 py-1.5 hover:border-point">
          ←
        </Link>
        <span className="rounded-lg bg-white px-3 py-1.5 tabular-nums text-navy">{ymd}</span>
        <Link href={`/manager/calendar?date=${addDays(ymd, view === "week" ? 7 : 1)}&view=${view}`} className="rounded-lg border border-line bg-white px-3 py-1.5 hover:border-point">
          →
        </Link>
        <Link
          href={`/manager/calendar?date=${ymd}&view=${view === "week" ? "day" : "week"}`}
          className="rounded-lg border border-line bg-white px-3 py-1.5 hover:border-point"
        >
          {view === "week" ? "Day view" : "Week view"}
        </Link>
      </div>
    </div>
  );
}
