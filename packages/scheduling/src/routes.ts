import type { GeoPoint } from "./engine";

export interface RouteStopInput {
  appointmentId: string;
  start: Date;
  location: GeoPoint | null;
}

export interface OrderedRoute {
  order: string[]; // appointment ids in recommended visit order
  totalTravelMinutes: number;
  legs: { fromId: string | null; toId: string; minutes: number }[];
}

/**
 * Route travel summary for stops in a given visit order (spec §75).
 * Travel between stops without geocodes uses `defaultLegMinutes`.
 */
export function routeTravel(
  stops: RouteStopInput[],
  travelMinutes: (a: GeoPoint, b: GeoPoint) => number,
  defaultLegMinutes = 25,
): OrderedRoute {
  const legs: OrderedRoute["legs"] = [];
  let total = 0;
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1]!;
    const b = stops[i]!;
    const minutes =
      a.location && b.location ? travelMinutes(a.location, b.location) : defaultLegMinutes;
    legs.push({ fromId: a.appointmentId, toId: b.appointmentId, minutes });
    total += minutes;
  }
  return { order: stops.map((s) => s.appointmentId), totalTravelMinutes: total, legs };
}

/**
 * Recommended stop order via nearest-neighbor from the first (earliest)
 * job — a transparent heuristic, not claimed optimal (spec §13 spirit).
 * Confirmed appointment windows are never moved by this function; it only
 * proposes a visit order for the owner to accept (spec §16).
 */
export function recommendStopOrder(
  stops: RouteStopInput[],
  travelMinutes: (a: GeoPoint, b: GeoPoint) => number,
  defaultLegMinutes = 25,
): OrderedRoute {
  if (stops.length <= 2) {
    return routeTravel(
      [...stops].sort((a, b) => a.start.getTime() - b.start.getTime()),
      travelMinutes,
      defaultLegMinutes,
    );
  }
  const byTime = [...stops].sort((a, b) => a.start.getTime() - b.start.getTime());
  const remaining = byTime.slice(1);
  const ordered = [byTime[0]!];
  while (remaining.length > 0) {
    const current = ordered[ordered.length - 1]!;
    let bestIndex = 0;
    let bestCost = Number.POSITIVE_INFINITY;
    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i]!;
      const cost =
        current.location && candidate.location
          ? travelMinutes(current.location, candidate.location)
          : defaultLegMinutes;
      if (cost < bestCost) {
        bestCost = cost;
        bestIndex = i;
      }
    }
    ordered.push(remaining.splice(bestIndex, 1)[0]!);
  }
  return routeTravel(ordered, travelMinutes, defaultLegMinutes);
}
