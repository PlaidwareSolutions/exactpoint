import { describe, expect, it } from "vitest";
import { recommendStopOrder, routeTravel, type RouteStopInput } from "./routes";
import type { GeoPoint } from "./engine";

const travel = (a: GeoPoint, b: GeoPoint) =>
  Math.round(
    Math.sqrt(
      ((a.longitude - b.longitude) * 97) ** 2 + ((a.latitude - b.latitude) * 111) ** 2,
    ) * 1.3,
  ) + 5;

const stop = (id: string, hour: number, lat: number, lng: number): RouteStopInput => ({
  appointmentId: id,
  start: new Date(Date.UTC(2026, 7, 18, hour)),
  location: { latitude: lat, longitude: lng },
});

describe("routeTravel", () => {
  it("sums leg travel in the given order", () => {
    const result = routeTravel(
      [stop("a", 13, 29.75, -95.7), stop("b", 15, 29.75, -95.6), stop("c", 17, 29.75, -95.5)],
      travel,
    );
    expect(result.legs).toHaveLength(2);
    expect(result.totalTravelMinutes).toBe(
      result.legs.reduce((s, l) => s + l.minutes, 0),
    );
  });
});

describe("recommendStopOrder", () => {
  it("proposes a shorter route when the time order zig-zags across town", () => {
    // Time order: west → far east → west again. Nearest-neighbor should
    // visit the two western stops consecutively.
    const stops = [
      stop("west1", 13, 29.75, -95.75),
      stop("east", 15, 29.75, -95.1),
      stop("west2", 17, 29.74, -95.74),
    ];
    const current = routeTravel(stops, travel);
    const recommended = recommendStopOrder(stops, travel);
    expect(recommended.order).toEqual(["west1", "west2", "east"]);
    expect(recommended.totalTravelMinutes).toBeLessThan(current.totalTravelMinutes);
  });

  it("keeps the earliest job first and handles missing geocodes", () => {
    const stops: RouteStopInput[] = [
      { appointmentId: "later", start: new Date(Date.UTC(2026, 7, 18, 16)), location: null },
      stop("first", 13, 29.75, -95.75),
    ];
    const recommended = recommendStopOrder(stops, travel);
    expect(recommended.order[0]).toBe("first");
    expect(recommended.totalTravelMinutes).toBe(25);
  });
});
