import { sql } from "drizzle-orm";
import type { Database } from "../client";

export interface ZonePolygonGeoJSON {
  id: string;
  zoneId: string;
  /** GeoJSON geometry (Polygon or MultiPolygon), parsed. */
  geometry: { type: string; coordinates: unknown };
}

export async function listZonePolygons(db: Database): Promise<ZonePolygonGeoJSON[]> {
  const result = await db.execute(sql`
    SELECT id, zone_id, ST_AsGeoJSON(geom) AS geojson FROM service_zone_polygons
  `);
  return (result.rows as { id: string; zone_id: string; geojson: string }[]).map((r) => ({
    id: r.id,
    zoneId: r.zone_id,
    geometry: JSON.parse(r.geojson),
  }));
}

/**
 * Stores a drawn polygon for a zone (spec §73). Rings are GeoJSON-style
 * [lng, lat] arrays; geometry is validated and forced to MultiPolygon.
 */
export async function insertZonePolygon(
  db: Database,
  zoneId: string,
  rings: [number, number][][],
): Promise<string> {
  const geojson = JSON.stringify({ type: "Polygon", coordinates: rings });
  const result = await db.execute(sql`
    INSERT INTO service_zone_polygons (zone_id, geom)
    VALUES (
      ${zoneId},
      ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(${geojson}), 4326)), 3))
    )
    RETURNING id
  `);
  return (result.rows[0] as { id: string }).id;
}

export async function deleteZonePolygon(db: Database, polygonId: string): Promise<void> {
  await db.execute(sql`DELETE FROM service_zone_polygons WHERE id = ${polygonId}`);
}
