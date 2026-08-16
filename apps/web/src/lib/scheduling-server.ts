import { eq } from "drizzle-orm";
import {
  getDb,
  loadSchedulingContext,
  schedulingSettings,
  serviceTypes,
  serviceZones,
  skills,
  type LoadedTechnician,
} from "@exactpoint/db";
import { BUSINESS } from "@exactpoint/domain";
import { haversineKm } from "@exactpoint/maps";
import type { EngineOptions, GeoPoint, SchedulingWeights } from "@exactpoint/scheduling";
import { routeProvider, usingGoogleGeo } from "@/lib/geo";

/**
 * Synchronous travel heuristic: road factor 1.35 over straight-line distance
 * at ~45 km/h plus 5 min overhead. Used directly when no Google key is
 * configured, and as the per-pair fallback where the Route Matrix has no
 * answer.
 */
export function estimateTravelMinutes(a: GeoPoint, b: GeoPoint): number {
  return Math.round(((haversineKm(a, b) * 1.35) / 45) * 60) + 5;
}

/** Short-lived cache of real drive times, keyed by rounded coordinate pair. */
const travelCache = new Map<string, { minutes: number; at: number }>();
const TRAVEL_CACHE_TTL_MS = 15 * 60_000;
const MATRIX_LOCATION_CAP = 24;

function pairKey(a: GeoPoint, b: GeoPoint): string {
  const r = (n: number) => n.toFixed(4);
  return `${r(a.latitude)},${r(a.longitude)}|${r(b.latitude)},${r(b.longitude)}`;
}

function cachedMinutes(a: GeoPoint, b: GeoPoint): number | null {
  const hit = travelCache.get(pairKey(a, b));
  if (hit && Date.now() - hit.at < TRAVEL_CACHE_TTL_MS) return hit.minutes;
  return null;
}

/**
 * Builds the engine's synchronous travel function backed by real drive times
 * (spec §15): one batched Route Matrix call covers request-location ↔ every
 * existing job location; uncovered pairs (job↔job direct legs used only in
 * soft scoring) fall back to the heuristic. Never throws — vendor failure
 * degrades to the heuristic.
 */
export async function travelFnForLocation(
  location: GeoPoint | null | undefined,
  team: LoadedTechnician[],
): Promise<(a: GeoPoint, b: GeoPoint) => number> {
  if (!location || !usingGoogleGeo) return estimateTravelMinutes;

  const jobLocations: GeoPoint[] = [];
  const seen = new Set<string>();
  for (const tech of team) {
    for (const day of tech.days) {
      for (const job of day.jobs) {
        if (!job.location) continue;
        const key = pairKey(job.location, job.location);
        if (seen.has(key)) continue;
        seen.add(key);
        jobLocations.push(job.location);
      }
    }
  }
  const targets = jobLocations
    .filter((j) => cachedMinutes(location, j) === null || cachedMinutes(j, location) === null)
    .slice(0, MATRIX_LOCATION_CAP);

  if (targets.length > 0) {
    try {
      const [outbound, inbound] = await Promise.all([
        routeProvider.travelMatrix([location], targets),
        routeProvider.travelMatrix(targets, [location]),
      ]);
      const now = Date.now();
      targets.forEach((target, i) => {
        const out = outbound[0]?.[i];
        const back = inbound[i]?.[0];
        if (out) travelCache.set(pairKey(location, target), { minutes: out.minutes, at: now });
        if (back) travelCache.set(pairKey(target, location), { minutes: back.minutes, at: now });
      });
    } catch (err) {
      console.error("[geo] travel matrix failed; heuristic in use", err);
    }
  }

  return (a, b) => cachedMinutes(a, b) ?? estimateTravelMinutes(a, b);
}

/**
 * Real drive times between a small set of route stops (Optimize Day):
 * one N×N matrix call, heuristic fallback per pair.
 */
export async function travelFnForStops(
  stops: GeoPoint[],
): Promise<(a: GeoPoint, b: GeoPoint) => number> {
  const located = stops.slice(0, 10);
  if (!usingGoogleGeo || located.length < 2) return estimateTravelMinutes;
  const missing = located.some((a) =>
    located.some((b) => a !== b && cachedMinutes(a, b) === null),
  );
  if (missing) {
    try {
      const grid = await routeProvider.travelMatrix(located, located);
      const now = Date.now();
      located.forEach((a, i) =>
        located.forEach((b, j) => {
          const cell = grid[i]?.[j];
          if (cell && i !== j) travelCache.set(pairKey(a, b), { minutes: cell.minutes, at: now });
        }),
      );
    } catch (err) {
      console.error("[geo] stops matrix failed; heuristic in use", err);
    }
  }
  return (a, b) => cachedMinutes(a, b) ?? estimateTravelMinutes(a, b);
}

export interface SchedulingConfig {
  weights: SchedulingWeights;
  granularityMinutes: number;
  bufferMinutes: number;
  bookingHorizonDays: number;
  holdMinutes: number;
  sameDayCutoff: string;
}

export async function loadSchedulingConfig(): Promise<SchedulingConfig> {
  const db = getDb();
  const [row] = await db.select().from(schedulingSettings).where(eq(schedulingSettings.id, 1));
  if (!row) throw new Error("scheduling_settings singleton missing — run seeds");
  return {
    weights: row.weights as SchedulingWeights,
    granularityMinutes: row.slotGranularityMinutes,
    bufferMinutes: row.bufferMinutes,
    bookingHorizonDays: row.bookingHorizonDays,
    holdMinutes: row.holdMinutes,
    sameDayCutoff: row.sameDayCutoff,
  };
}

export async function engineOptionsFromConfig(
  config: SchedulingConfig,
): Promise<EngineOptions> {
  const db = getDb();
  const zones = await db.select().from(serviceZones);
  const zonePreferredDays = new Map(
    zones
      .filter((z) => z.preferredDays && z.preferredDays.length > 0)
      .map((z) => [z.id, z.preferredDays as number[]]),
  );
  return {
    weights: config.weights,
    granularityMinutes: config.granularityMinutes,
    bufferMinutes: config.bufferMinutes,
    travelMinutes: estimateTravelMinutes,
    zonePreferredDays,
  };
}

export async function loadTeamContext(options?: {
  fromYmd?: string;
  days?: number;
  customerId?: string;
  includeInactive?: boolean;
}): Promise<LoadedTechnician[]> {
  return loadSchedulingContext(getDb(), {
    timezone: BUSINESS.timezone,
    fromYmd: options?.fromYmd,
    days: options?.days ?? 7,
    customerId: options?.customerId,
    includeInactive: options?.includeInactive,
  });
}

export async function requiredSkillForServiceType(
  serviceTypeSlug: string,
): Promise<{ serviceTypeId: string | null; skillSlug: string | null; durationMinutes: number }> {
  const db = getDb();
  const [row] = await db
    .select({
      id: serviceTypes.id,
      durationMinutes: serviceTypes.defaultDurationMinutes,
      skillSlug: skills.slug,
    })
    .from(serviceTypes)
    .leftJoin(skills, eq(serviceTypes.requiredSkillId, skills.id))
    .where(eq(serviceTypes.slug, serviceTypeSlug));
  if (!row) return { serviceTypeId: null, skillSlug: null, durationMinutes: 90 };
  return {
    serviceTypeId: row.id,
    skillSlug: row.skillSlug,
    durationMinutes: row.durationMinutes,
  };
}
