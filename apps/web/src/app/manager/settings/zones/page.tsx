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
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate">
          Polygon boundaries (drawn on the map) classify addresses first; ZIP
          membership is the fallback. Each ZIP belongs to one zone.
        </p>
        <a
          href="/manager/settings/zones/map"
          className="shrink-0 rounded-lg bg-navy px-4 py-2 text-sm font-bold text-white hover:bg-navy-soft"
        >
          Draw boundaries →
        </a>
      </div>
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
