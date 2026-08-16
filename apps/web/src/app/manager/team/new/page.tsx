import { getDb, serviceZones, skills } from "@exactpoint/db";
import { TeamEditor } from "../team-editor";

export const metadata = { title: "Add Technician" };
export const dynamic = "force-dynamic";

export default async function NewTechnicianPage() {
  const db = getDb();
  const [allSkills, allZones] = await Promise.all([
    db.select().from(skills),
    db.select().from(serviceZones),
  ]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-navy">Add Technician</h1>
      <TeamEditor
        initial={{
          firstName: "",
          lastName: "",
          mobile: "",
          email: "",
          title: "",
          color: "#0891b2",
          startDate: "",
          maxDailyJobs: "",
          emergencyAvailable: false,
          notes: "",
          isActive: true,
          hasLogin: false,
          skills: [],
          availability: [],
          zoneIds: [],
        }}
        allSkills={allSkills.map((s) => ({ slug: s.slug, name: s.name, category: s.category }))}
        allZones={allZones.map((z) => ({ id: z.id, name: z.name }))}
        timeOff={[]}
      />
    </div>
  );
}
