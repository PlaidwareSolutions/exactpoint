import { overlaps } from "./availability";
import type { Reservation, TechnicianSnapshot, TimeWindow } from "./types";

/**
 * HARD CONSTRAINTS — these decide whether a candidate slot may exist at all.
 * Soft preferences (scoring) only rank slots that pass every one of these.
 * Never relax a hard constraint to improve a score.
 */

export function isQualified(tech: TechnicianSnapshot, requiredSkillSlug: string | null): boolean {
  if (!tech.isActive) return false;
  if (!requiredSkillSlug) return true;
  return tech.skillSlugs.includes(requiredSkillSlug);
}

export function fitsWithinShift(candidate: TimeWindow, shift: TimeWindow): boolean {
  return candidate.start >= shift.start && candidate.end <= shift.end;
}

export function conflictsWithReservations(
  candidate: TimeWindow,
  technicianId: string,
  reservations: Reservation[],
): boolean {
  return reservations.some(
    (r) => r.technicianId === technicianId && overlaps(r, candidate),
  );
}

/**
 * Travel feasibility between consecutive jobs: the gap between the previous
 * job's end and the candidate's start must cover estimated travel minutes.
 */
export function travelFeasible(
  previousEnd: Date | null,
  candidateStart: Date,
  estimatedTravelMinutes: number,
): boolean {
  if (previousEnd === null) return true;
  const gapMinutes = (candidateStart.getTime() - previousEnd.getTime()) / 60_000;
  return gapMinutes >= estimatedTravelMinutes;
}
