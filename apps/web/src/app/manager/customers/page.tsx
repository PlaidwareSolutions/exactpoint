import Link from "next/link";
import { desc } from "drizzle-orm";
import { customers, getDb } from "@exactpoint/db";

export const metadata = { title: "Customers" };
export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const rows = await getDb()
    .select()
    .from(customers)
    .orderBy(desc(customers.createdAt))
    .limit(200);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-navy">Customers</h1>
      <div className="overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-wider text-slate">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Since</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((c) => (
              <tr key={c.id} className="hover:bg-mist">
                <td className="px-4 py-3 font-semibold text-navy">
                  <Link href={`/manager/customers/${c.id}`}>
                    {c.firstName} {c.lastName}
                  </Link>
                </td>
                <td className="px-4 py-3">{c.phone}</td>
                <td className="px-4 py-3 text-slate">{c.email}</td>
                <td className="px-4 py-3 text-slate">
                  {c.createdAt.toISOString().slice(0, 10)}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate">
                  No customers yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
