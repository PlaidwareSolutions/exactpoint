import { customType } from "drizzle-orm/pg-core";

/**
 * PostgreSQL tstzrange. Values pass through as range literals, e.g.
 * `["2026-08-18T15:00:00.000Z","2026-08-18T17:00:00.000Z")`.
 * Use `toTstzRange` to build literals from Dates.
 */
export const tstzrange = customType<{ data: string }>({
  dataType() {
    return "tstzrange";
  },
});

/** Builds a half-open [start, end) tstzrange literal from two instants. */
export function toTstzRange(start: Date, end: Date): string {
  return `["${start.toISOString()}","${end.toISOString()}")`;
}

/** PostGIS point in WGS 84. Values are WKT/EWKT or hex EWKB strings. */
export const geometryPoint = customType<{ data: string }>({
  dataType() {
    return "geometry(Point,4326)";
  },
});

/** PostGIS multipolygon in WGS 84 for service-zone boundaries. */
export const geometryMultiPolygon = customType<{ data: string }>({
  dataType() {
    return "geometry(MultiPolygon,4326)";
  },
});

/** Builds an EWKT point from longitude/latitude. */
export function toEwktPoint(longitude: number, latitude: number): string {
  return `SRID=4326;POINT(${longitude} ${latitude})`;
}
