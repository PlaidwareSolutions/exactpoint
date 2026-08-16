/**
 * Pure scheduling-engine types. This package must stay free of framework,
 * database, and vendor imports so the engine is independently testable.
 */

export interface TimeWindow {
  start: Date;
  end: Date;
}

/** A technician's working window on a concrete date (shift template resolved). */
export interface ShiftWindow extends TimeWindow {
  technicianId: string;
}

/** Any committed consumption of a technician's time (appointment, hold, time off, block). */
export interface Reservation extends TimeWindow {
  technicianId: string;
}

export interface TechnicianSnapshot {
  id: string;
  isActive: boolean;
  skillSlugs: string[];
  maxDailyJobs?: number | null;
  emergencyAvailable?: boolean;
  preferredZoneIds?: string[];
}

export interface CandidateSlot {
  technicianId: string;
  window: TimeWindow;
  /** Per-component score breakdown — recommendations must be explainable. */
  scoreBreakdown: ScoreComponent[];
  totalScore: number;
}

export interface ScoreComponent {
  key: string;
  label: string;
  value: number;
}

/** Owner-tunable soft-preference weights (stored in scheduling_settings). */
export interface SchedulingWeights {
  customerPreference: number;
  zoneAffinity: number;
  routeProximity: number;
  travelEfficiency: number;
  scheduleCompactness: number;
  workloadBalance: number;
  technicianContinuity: number;
  preferredZoneDay: number;
  penaltyPerAdditionalTravelMinute: number;
  penaltyRouteFragmentation: number;
  penaltyIdleGap: number;
  penaltyCrossTownTravel: number;
}
