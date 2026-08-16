import { asc } from "drizzle-orm";
import { getDb, listZonePolygons, serviceZones } from "@exactpoint/db";
import { ZoneBoundaryEditor } from "./boundary-editor";

export const metadata = { title: "Zone Boundaries" };
export const dynamic = "force-dynamic";

export default async function ZoneBoundariesPage() {
  const db = getDb();
  const [zones, polygons] = await Promise.all([
    db.select().from(serviceZones).orderBy(asc(serviceZones.name)),
    listZonePolygons(db),
  ]);

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate">
        Draw each zone&apos;s boundary on the map. Polygon containment becomes
        the primary way customer addresses are classified; ZIP membership
        remains the fallback. Click an existing shape to delete it.
      </p>
      <ZoneBoundaryEditor
        zones={zones.map((z) => ({
          id: z.id,
          name: z.name,
          color: z.color ?? "#4f46e5",
        }))}
        polygons={polygons.map((p) => ({
          id: p.id,
          zoneId: p.zoneId,
          geometry: p.geometry as { type: string; coordinates: number[][][] | number[][][][] },
        }))}
      />
    </div>
  );
}
