import { describe, expect, it } from "vitest";
import { parseRouteMatrixResponse, parseValidateAddressResponse } from "./google";

const input = { street: "23945 Franz Rd", city: "Katy", state: "tx", zip: "77493" };

describe("parseValidateAddressResponse", () => {
  it("maps PREMISE granularity to confirmed with geocode", () => {
    const result = parseValidateAddressResponse(
      {
        result: {
          verdict: { validationGranularity: "PREMISE" },
          geocode: { location: { latitude: 29.80127, longitude: -95.7845 } },
          address: {
            formattedAddress: "23945 Franz Road, Katy, TX 77493-2598, USA",
            postalAddress: {
              addressLines: ["23945 Franz Road"],
              locality: "Katy",
              administrativeArea: "TX",
              postalCode: "77493-2598",
            },
          },
        },
      },
      input,
    );
    expect(result.confidence).toBe("confirmed");
    expect(result.latitude).toBeCloseTo(29.80127);
    expect(result.standardized.zip).toBe("77493");
    expect(result.standardized.city).toBe("Katy");
  });

  it("maps coarse granularity to unresolved", () => {
    const result = parseValidateAddressResponse(
      { result: { verdict: { validationGranularity: "OTHER" } } },
      input,
    );
    expect(result.confidence).toBe("unresolved");
  });

  it("handles a missing result payload", () => {
    expect(parseValidateAddressResponse({}, input).confidence).toBe("unresolved");
  });
});

describe("parseRouteMatrixResponse", () => {
  const katy = { latitude: 29.7858, longitude: -95.8245 };
  const pearland = { latitude: 29.5544, longitude: -95.2864 };

  it("uses engine durations for routable pairs", () => {
    const grid = parseRouteMatrixResponse(
      [
        {
          originIndex: 0,
          destinationIndex: 0,
          duration: "2940s",
          distanceMeters: 72600,
          condition: "ROUTE_EXISTS",
        },
      ],
      [katy],
      [pearland],
    );
    expect(grid[0]![0]!).toEqual({ minutes: 49, distanceKm: 72.6, fromRouteEngine: true });
  });

  it("falls back to the heuristic for unroutable or missing elements", () => {
    const grid = parseRouteMatrixResponse([], [katy], [pearland]);
    expect(grid[0]![0]!.fromRouteEngine).toBe(false);
    expect(grid[0]![0]!.minutes).toBeGreaterThan(30);
  });
});
