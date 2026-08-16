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

/**
 * Synchronous travel heuristic for the engine: road factor 1.35 over
 * straight-line distance at ~45 km/h plus 5 min overhead. Replaced by the
 * Google Route Matrix provider when API keys are supplied (spec §15).
 */
export function estimateTravelMinutes(a: GeoPoint, b: GeoPoint): number {
  return Math.round(((haversineKm(a, b) * 1.35) / 45) * 60) + 5;
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
