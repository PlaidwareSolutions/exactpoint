import { candidateStarts, durationMinutes, overlaps } from "./availability";
import { isQualified } from "./hard-constraints";
import type {
  CandidateSlot,
  Reservation,
  ScoreComponent,
  SchedulingWeights,
  TechnicianSnapshot,
  TimeWindow,
} from "./types";

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

/** An existing job on a technician's day, with whatever geo context is known. */
export interface DayJob extends TimeWindow {
  zoneId?: string | null;
  location?: GeoPoint | null;
}

/** One technician's resolved situation for one date. */
export interface TechnicianDay {
  /** YYYY-MM-DD in the business timezone. */
  date: string;
  /** Working window for that date; null = not working (day off / no shift). */
  shift: TimeWindow | null;
  /** Every reservation that day (appointments, holds, time off, blocks). */
  reservations: Reservation[];
  /** Existing appointments with geo context (subset of reservations). */
  jobs: DayJob[];
}

export interface TechnicianContext extends TechnicianSnapshot {
  days: TechnicianDay[];
  /** True when this technician has previously served this customer. */
  hasServedCustomer?: boolean;
}

export interface CandidateRequest {
  durationMinutes: number;
  requiredSkillSlug: string | null;
  zoneId?: string | null;
  location?: GeoPoint | null;
  urgency: "normal" | "emergency";
  /** Customer-preferred windows (already resolved to instants). */
  preferredWindows?: TimeWindow[];
}

export interface EngineOptions {
  weights: SchedulingWeights;
  granularityMinutes: number;
  bufferMinutes: number;
  /**
   * Travel-minutes estimator injected by the caller (haversine heuristic in
   * dev, Routes API later) so this package stays vendor-free (spec §84).
   */
  travelMinutes: (a: GeoPoint, b: GeoPoint) => number;
  /** Assumed travel when either side lacks a geocode. */
  defaultTravelMinutes?: number;
  /** Zone id → preferred weekdays (0=Sun..6=Sat). */
  zonePreferredDays?: ReadonlyMap<string, readonly number[]>;
  maxCandidatesPerTechnician?: number;
  now?: Date;
}

interface Neighbors {
  prev: DayJob | null;
  next: DayJob | null;
}

function neighborsOf(jobs: DayJob[], start: Date, end: Date): Neighbors {
  let prev: DayJob | null = null;
  let next: DayJob | null = null;
  for (const job of jobs) {
    if (job.end <= start && (!prev || job.end > prev.end)) prev = job;
    if (job.start >= end && (!next || job.start < next.start)) next = job;
  }
  return { prev, next };
}

const CROSS_TOWN_MINUTES = 45;

/**
 * Generates scored candidate slots for a request across the team.
 *
 * HARD constraints filter candidates out entirely; soft preferences only rank
 * the survivors, using owner-tunable weights. Scores are explainable
 * heuristics — never presented as mathematically optimal (spec §13).
 */
export function generateCandidates(
  request: CandidateRequest,
  technicians: TechnicianContext[],
  options: EngineOptions,
): CandidateSlot[] {
  const {
    weights,
    granularityMinutes,
    bufferMinutes,
    travelMinutes,
    defaultTravelMinutes = 25,
    zonePreferredDays,
    maxCandidatesPerTechnician = 6,
    now = new Date(),
  } = options;

  const travelBetween = (a?: GeoPoint | null, b?: GeoPoint | null): number =>
    a && b ? travelMinutes(a, b) : defaultTravelMinutes;

  const qualified = technicians.filter((t) =>
    isQualified(t, request.requiredSkillSlug),
  );
  const activeJobCounts = qualified.map((t) =>
    t.days.reduce((sum, d) => sum + d.jobs.length, 0),
  );
  const teamAvgJobs =
    activeJobCounts.length > 0
      ? activeJobCounts.reduce((a, b) => a + b, 0) / activeJobCounts.length
      : 0;

  const out: CandidateSlot[] = [];

  for (const tech of qualified) {
    let produced = 0;
    for (const day of tech.days) {
      if (!day.shift) continue; // day off, time off spanning the day, Sunday…
      if (
        tech.maxDailyJobs != null &&
        day.jobs.length >= tech.maxDailyJobs
      ) {
        continue;
      }

      const starts = candidateStarts(
        day.shift,
        day.reservations,
        request.durationMinutes,
        granularityMinutes,
        bufferMinutes,
      );

      for (const start of starts) {
        if (start <= now) continue;
        if (produced >= maxCandidatesPerTechnician) break;
        const end = new Date(start.getTime() + request.durationMinutes * 60_000);
        const window: TimeWindow = { start, end };

        // HARD: travel feasibility against neighboring jobs.
        const { prev, next } = neighborsOf(day.jobs, start, end);
        const travelIn = prev ? travelBetween(prev.location, request.location) : 0;
        const travelOut = next ? travelBetween(request.location, next.location) : 0;
        if (prev && (start.getTime() - prev.end.getTime()) / 60_000 < travelIn) continue;
        if (next && (next.start.getTime() - end.getTime()) / 60_000 < travelOut) continue;

        const components: ScoreComponent[] = [];
        const add = (key: string, label: string, value: number) => {
          if (value !== 0) components.push({ key, label, value: Math.round(value * 10) / 10 });
        };

        // Customer preference
        if (request.preferredWindows?.some((w) => overlaps(w, window))) {
          add("customerPreference", "Matches the customer's preferred time", weights.customerPreference);
        }

        // Zone affinity: existing same-zone jobs that day
        if (request.zoneId) {
          const sameZone = day.jobs.filter((j) => j.zoneId === request.zoneId).length;
          if (sameZone > 0) {
            add(
              "zoneAffinity",
              `${sameZone} existing job${sameZone > 1 ? "s" : ""} in the same zone that day`,
              (Math.min(sameZone, 3) / 3) * weights.zoneAffinity,
            );
          }
        }

        // Route proximity: travel to the nearest neighboring job
        const neighborTravel = [
          prev ? travelBetween(prev.location, request.location) : null,
          next ? travelBetween(request.location, next.location) : null,
        ].filter((v): v is number => v != null);
        if (neighborTravel.length > 0) {
          const nearest = Math.min(...neighborTravel);
          add(
            "routeProximity",
            `≈${Math.round(nearest)} min from the nearest job on the route`,
            (1 - Math.min(nearest, 60) / 60) * weights.routeProximity,
          );
          if (nearest > CROSS_TOWN_MINUTES) {
            add(
              "crossTown",
              `Cross-town travel (≈${Math.round(nearest)} min)`,
              weights.penaltyCrossTownTravel,
            );
          }
          // Incremental travel of inserting this job into the route
          if (prev && next) {
            const direct = travelBetween(prev.location, next.location);
            const incremental = travelIn + travelOut - direct;
            if (incremental > 0) {
              add(
                "travelDelta",
                `Adds ≈${Math.round(incremental)} min of driving`,
                incremental * weights.penaltyPerAdditionalTravelMinute,
              );
            }
          }
          add(
            "travelEfficiency",
            "Travel-efficient placement",
            (1 - Math.min(nearest, 60) / 60) * weights.travelEfficiency,
          );
        }

        // Compactness: idle gap left between this job and its neighbors
        const gapBefore = prev
          ? (start.getTime() - prev.end.getTime()) / 60_000 - travelIn
          : null;
        const gapAfter = next
          ? (next.start.getTime() - end.getTime()) / 60_000 - travelOut
          : null;
        const idle = Math.max(gapBefore ?? 0, gapAfter ?? 0);
        if (idle > 60) {
          add(
            "idleGap",
            `Leaves an idle gap of ≈${Math.round(idle)} min`,
            weights.penaltyIdleGap * Math.min(idle / 120, 2),
          );
        } else if (prev || next) {
          add("compactness", "Keeps the route compact", weights.scheduleCompactness);
        }

        // Workload balance across the team
        const techJobs = tech.days.reduce((s, d) => s + d.jobs.length, 0);
        if (teamAvgJobs > 0) {
          const balance = Math.max(-1, Math.min(1, (teamAvgJobs - techJobs) / teamAvgJobs));
          add("workload", balance >= 0 ? "Balances team workload" : "Technician already heavily booked", balance * weights.workloadBalance);
        }

        if (tech.hasServedCustomer) {
          add("continuity", "Has serviced this customer before", weights.technicianContinuity);
        }

        if (request.zoneId && zonePreferredDays) {
          const preferred = zonePreferredDays.get(request.zoneId);
          const weekday = new Date(`${day.date}T12:00:00Z`).getUTCDay();
          if (preferred?.includes(weekday)) {
            add("preferredDay", "Zone's preferred service day", weights.preferredZoneDay);
          }
        }

        if (tech.preferredZoneIds?.length && request.zoneId) {
          if (tech.preferredZoneIds.includes(request.zoneId)) {
            add("techZonePreference", "Technician prefers this zone", weights.preferredZoneDay);
          }
        }

        const totalScore = components.reduce((s, c) => s + c.value, 0);
        out.push({
          technicianId: tech.id,
          window,
          scoreBreakdown: components,
          totalScore: Math.round(totalScore * 10) / 10,
        });
        produced++;
      }
    }
  }

  if (request.urgency === "emergency") {
    // Emergency: earliest feasible arrival wins; score breaks ties (spec §28).
    return out.sort(
      (a, b) =>
        a.window.start.getTime() - b.window.start.getTime() ||
        b.totalScore - a.totalScore,
    );
  }
  return out.sort(
    (a, b) =>
      b.totalScore - a.totalScore ||
      a.window.start.getTime() - b.window.start.getTime(),
  );
}

/**
 * Multi-technician jobs (spec §6, Test I): a slot is only valid where every
 * required technician can hold it simultaneously.
 */
export function generateMultiTechnicianCandidates(
  request: CandidateRequest,
  requiredTechnicians: TechnicianContext[][],
  options: EngineOptions,
): { window: TimeWindow; technicianIds: string[] }[] {
  if (requiredTechnicians.length === 0) return [];
  const perRole = requiredTechnicians.map((pool) =>
    generateCandidates(request, pool, options),
  );
  const first = perRole[0]!;
  const results: { window: TimeWindow; technicianIds: string[] }[] = [];

  for (const candidate of first) {
    const team: string[] = [candidate.technicianId];
    let ok = true;
    for (const role of perRole.slice(1)) {
      const match = role.find(
        (c) =>
          c.window.start.getTime() === candidate.window.start.getTime() &&
          !team.includes(c.technicianId),
      );
      if (!match) {
        ok = false;
        break;
      }
      team.push(match.technicianId);
    }
    if (ok) results.push({ window: candidate.window, technicianIds: team });
    if (results.length >= 10) break;
  }
  return results;
}

/**
 * Manual-override validation (spec Test L): the owner may assign anyone as
 * long as HARD constraints hold; soft concerns come back as warnings only.
 */
export function validateAssignment(
  tech: TechnicianContext,
  day: TechnicianDay | undefined,
  window: TimeWindow,
  requiredSkillSlug: string | null,
  options: Pick<EngineOptions, "travelMinutes" | "defaultTravelMinutes">,
  location?: GeoPoint | null,
): { ok: boolean; blockers: string[]; warnings: string[] } {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!tech.isActive) blockers.push("Technician is inactive");
  if (requiredSkillSlug && !tech.skillSlugs.includes(requiredSkillSlug)) {
    blockers.push("Technician does not have the required skill");
  }
  if (!day?.shift) {
    blockers.push("Technician is not working that day");
  } else {
    if (window.start < day.shift.start || window.end > day.shift.end) {
      warnings.push("Outside the technician's normal working hours");
    }
    if (day.reservations.some((r) => overlaps(r, window))) {
      blockers.push("Conflicts with an existing reservation");
    }
    const { prev, next } = neighborsOf(day.jobs, window.start, window.end);
    const travelBetween = (a?: GeoPoint | null, b?: GeoPoint | null) =>
      a && b ? options.travelMinutes(a, b) : (options.defaultTravelMinutes ?? 25);
    if (prev) {
      const needed = travelBetween(prev.location, location);
      const gap = (window.start.getTime() - prev.end.getTime()) / 60_000;
      if (gap < needed) blockers.push(`Not enough travel time from the previous job (needs ≈${Math.round(needed)} min)`);
      else if (needed > CROSS_TOWN_MINUTES) warnings.push(`Adds ≈${Math.round(needed)} min of travel from the previous job`);
    }
    if (next) {
      const needed = travelBetween(location, next.location);
      const gap = (next.start.getTime() - window.end.getTime()) / 60_000;
      if (gap < needed) blockers.push(`Not enough travel time to the next job (needs ≈${Math.round(needed)} min)`);
    }
  }

  return { ok: blockers.length === 0, blockers, warnings };
}

export { durationMinutes };
