import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb, skills, technicianProfiles, technicianSkills } from "@exactpoint/db";

export const metadata = { title: "Team" };
export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const db = getDb();
  const team = await db.select().from(technicianProfiles);
  const skillRows = await db
    .select({ technicianId: technicianSkills.technicianId, name: skills.name })
    .from(technicianSkills)
    .innerJoin(skills, eq(technicianSkills.skillId, skills.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-navy">Team</h1>
        <Link
          href="/manager/team/new"
          className="rounded-lg bg-point px-4 py-2 text-sm font-bold text-white hover:bg-point-deep"
        >
          Add Technician
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {team.map((t) => {
          const mySkills = skillRows.filter((s) => s.technicianId === t.id);
          return (
            <Link
              key={t.id}
              href={`/manager/team/${t.id}`}
              className={`rounded-xl border bg-white p-5 transition hover:border-point ${
                t.isActive ? "border-line" : "border-line opacity-60"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-bold text-navy">
                  <span
                    className="size-3 rounded-full"
                    style={{ background: t.color ?? "#94a3b8" }}
                  />
                  {t.firstName} {t.lastName}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    t.isActive ? "bg-emerald-50 text-emerald-700" : "bg-mist text-slate"
                  }`}
                >
                  {t.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate">
                {mySkills.length} skill{mySkills.length === 1 ? "" : "s"}
                {t.emergencyAvailable ? " · emergency calls" : ""}
                {t.userId ? " · has login" : " · no login yet"}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
