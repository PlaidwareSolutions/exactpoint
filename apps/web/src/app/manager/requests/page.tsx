import Link from "next/link";
import { listServiceRequests } from "@/lib/manager/queries";

export const metadata = { title: "Requests" };
export const dynamic = "force-dynamic";

const STATUSES = ["new", "reviewed", "converted", "declined", "spam"] as const;

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const raw = (await searchParams).status;
  const status = (STATUSES as readonly string[]).includes(raw ?? "")
    ? (raw as (typeof STATUSES)[number])
    : "new";
  const requests = await listServiceRequests({ status });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-navy">Service Requests</h1>
      <div className="flex gap-2">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/manager/requests?status=${s}`}
            className={`rounded-full px-3 py-1 text-sm font-semibold ${
              s === status ? "bg-navy text-white" : "bg-white text-slate hover:text-navy"
            }`}
          >
            {s}
          </Link>
        ))}
      </div>
      <div className="overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wider text-slate">
            <tr>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Service</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Area</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Received</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {requests.map((r) => (
              <tr key={r.id} className="hover:bg-mist">
                <td className="px-4 py-3 font-bold text-navy">
                  <Link href={`/manager/requests/${r.id}`}>{r.reference}</Link>
                </td>
                <td className="px-4 py-3">{r.serviceName ?? r.serviceOther ?? "Other"}</td>
                <td className="px-4 py-3">
                  {r.customerFirst} {r.customerLast}
                </td>
                <td className="px-4 py-3 text-slate">
                  {r.zoneName ?? r.city}
                </td>
                <td className="px-4 py-3">
                  {r.urgency === "emergency" ? (
                    <span className="rounded-full bg-point/10 px-2 py-0.5 text-xs font-bold text-point">
                      EMERGENCY
                    </span>
                  ) : (
                    <span className="text-slate">normal</span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate">
                  {new Intl.DateTimeFormat("en-US", {
                    timeZone: "America/Chicago",
                    month: "numeric",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  }).format(r.createdAt)}
                </td>
              </tr>
            ))}
            {requests.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate">
                  No {status} requests.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
