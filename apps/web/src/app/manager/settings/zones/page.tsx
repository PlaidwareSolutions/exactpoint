import { asc } from "drizzle-orm";
import { getDb, serviceZones, serviceZoneZips } from "@exactpoint/db";
import { ZoneCard } from "./zone-card";

export const metadata = { title: "Service Zones" };
export const dynamic = "force-dynamic";

export default async function ZonesSettingsPage() {
  const db = getDb();
  const zones = await db.select().from(serviceZones).orderBy(asc(serviceZones.name));
  const zips = await db.select().from(serviceZoneZips);

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate">
        ZIP membership drives zone classification today; polygon boundaries can
        be drawn once Google Maps keys are configured. Each ZIP belongs to one
        zone.
      </p>
      <div className="grid gap-3 lg:grid-cols-2">
        {zones.map((zone) => (
          <ZoneCard
            key={zone.id}
            zone={{
              id: zone.id,
              name: zone.name,
              color: zone.color ?? "#4f46e5",
              isActive: zone.isActive,
              priority: zone.priority,
              preferredDays: (zone.preferredDays as number[] | null) ?? [],
            }}
            zips={zips
              .filter((z) => z.zoneId === zone.id)
              .map((z) => z.zip)
              .sort()}
          />
        ))}
      </div>
    </div>
  );
}
