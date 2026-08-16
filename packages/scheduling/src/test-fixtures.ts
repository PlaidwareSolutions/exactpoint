import type { SchedulingWeights } from "./types";

/** Mirror of the seeded production defaults, for deterministic tests. */
export const DEFAULT_WEIGHTS_FOR_TESTS: SchedulingWeights = {
  customerPreference: 30,
  zoneAffinity: 20,
  routeProximity: 20,
  travelEfficiency: 15,
  scheduleCompactness: 10,
  workloadBalance: 10,
  technicianContinuity: 5,
  preferredZoneDay: 5,
  penaltyPerAdditionalTravelMinute: -0.5,
  penaltyRouteFragmentation: -10,
  penaltyIdleGap: -5,
  penaltyCrossTownTravel: -15,
};
