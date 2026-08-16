import { addDays } from "@exactpoint/scheduling";
import { todayYmd, zoneDayMatrix } from "@/lib/manager/queries";

export const metadata = { title: "Area View" };
export const dynamic = "force-dynamic";

/**
 * §19 geographic scheduling view: appointments per zone per day, so
 * inefficient fragmentation is visible at a glance. The tile map view (§20)
 * activates when Google Maps keys are configured.
 */
export default async function AreaPage() {
  const from = todayYmd();
  const days = [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(from, i));
  const rows = await zoneDayMatrix(from, 7);
  const zones = [...new Set(rows.map((r) => r.zoneName))].sort();

  const lookup = new Map(rows.map((r) => [`${r.zoneName}|${r.day}`, r.total]));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-navy">Area View</h1>
      <p className="text-sm text-slate">
        Appointments by zone over the next 7 days. Heavy days in one zone are
        good routes; scattered single jobs are travel waste.
      </p>
      <div className="overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wider text-slate">
              <th className="px-4 py-2 text-left">Zone</th>
              {days.map((d) => (
                <th key={d} className="px-3 py-2 text-center tabular-nums">
                  {d.slice(5)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {zones.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate">
                  No scheduled appointments in the next 7 days yet.
                </td>
              </tr>
            )}
            {zones.map((zone) => (
              <tr key={zone}>
                <td className="px-4 py-2 font-semibold text-navy">{zone}</td>
                {days.map((d) => {
                  const total = lookup.get(`${zone}|${d}`) ?? 0;
                  return (
                    <td key={d} className="px-3 py-2 text-center">
                      {total > 0 ? (
                        <span
                          className={`inline-block min-w-7 rounded-full px-2 py-0.5 font-bold ${
                            total >= 3 ? "bg-navy text-white" : "bg-mist text-navy"
                          }`}
                        >
                          {total}
                        </span>
                      ) : (
                        <span className="text-line">·</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="rounded-xl border border-line bg-white px-4 py-3 text-sm text-slate">
        The live route map (§20) switches on once Google Maps API keys are
        supplied — zone analytics work without it.
      </p>
    </div>
  );
}
