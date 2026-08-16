import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import {
  getDb,
  serviceZones,
  skills,
  technicianAvailability,
  technicianProfiles,
  technicianSkills,
  technicianTimeOff,
  technicianZonePreferences,
} from "@exactpoint/db";
import { TeamEditor } from "../team-editor";

export const dynamic = "force-dynamic";

export default async function TechnicianDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const [tech] = await db
    .select()
    .from(technicianProfiles)
    .where(eq(technicianProfiles.id, id));
  if (!tech) notFound();

  const [allSkills, allZones, mySkills, myZones, myAvailability, myTimeOff] =
    await Promise.all([
      db.select().from(skills),
      db.select().from(serviceZones),
      db
        .select({ slug: skills.slug })
        .from(technicianSkills)
        .innerJoin(skills, eq(technicianSkills.skillId, skills.id))
        .where(eq(technicianSkills.technicianId, id)),
      db
        .select()
        .from(technicianZonePreferences)
        .where(eq(technicianZonePreferences.technicianId, id)),
      db
        .select()
        .from(technicianAvailability)
        .where(eq(technicianAvailability.technicianId, id)),
      db
        .select()
        .from(technicianTimeOff)
        .where(eq(technicianTimeOff.technicianId, id))
        .orderBy(desc(technicianTimeOff.createdAt))
        .limit(20),
    ]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-navy">
        {tech.firstName} {tech.lastName}
      </h1>
      <TeamEditor
        initial={{
          id: tech.id,
          firstName: tech.firstName,
          lastName: tech.lastName,
          mobile: tech.mobile ?? "",
          email: tech.email ?? "",
          title: tech.title ?? "",
          color: tech.color ?? "#0891b2",
          startDate: tech.startDate ?? "",
          maxDailyJobs: tech.maxDailyJobs?.toString() ?? "",
          emergencyAvailable: tech.emergencyAvailable,
          notes: tech.notes ?? "",
          isActive: tech.isActive,
          hasLogin: Boolean(tech.userId),
          skills: mySkills.map((s) => s.slug),
          availability: myAvailability.map((a) => ({
            dayOfWeek: a.dayOfWeek,
            startTime: a.startTime.slice(0, 5),
            endTime: a.endTime.slice(0, 5),
          })),
          zoneIds: myZones.map((z) => z.zoneId),
        }}
        allSkills={allSkills.map((s) => ({ slug: s.slug, name: s.name, category: s.category }))}
        allZones={allZones.map((z) => ({ id: z.id, name: z.name }))}
        timeOff={myTimeOff.map((t) => ({
          id: t.id,
          period: t.period,
          type: t.type,
          note: t.note,
        }))}
      />
    </div>
  );
}
