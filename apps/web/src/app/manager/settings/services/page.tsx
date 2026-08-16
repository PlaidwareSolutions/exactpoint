import { asc, eq } from "drizzle-orm";
import { getDb, serviceCategories, serviceTypes, skills } from "@exactpoint/db";
import { ServiceRow } from "./service-row";

export const metadata = { title: "Services" };
export const dynamic = "force-dynamic";

export default async function ServicesSettingsPage() {
  const rows = await getDb()
    .select({
      id: serviceTypes.id,
      name: serviceTypes.name,
      category: serviceCategories.name,
      durationMinutes: serviceTypes.defaultDurationMinutes,
      isActive: serviceTypes.isActive,
      requiredSkill: skills.name,
    })
    .from(serviceTypes)
    .innerJoin(serviceCategories, eq(serviceTypes.categoryId, serviceCategories.id))
    .leftJoin(skills, eq(serviceTypes.requiredSkillId, skills.id))
    .orderBy(asc(serviceTypes.sortOrder));

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-line text-xs uppercase tracking-wider text-slate">
          <tr>
            <th className="px-4 py-3">Service</th>
            <th className="px-4 py-3">Category</th>
            <th className="px-4 py-3">Required skill</th>
            <th className="px-4 py-3">Default duration</th>
            <th className="px-4 py-3">Active</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <ServiceRow key={r.id} service={r} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
