import { describe, expect, it } from "vitest";
import { HaversineRouteProvider, StubAddressProvider } from "./stub";

describe("StubAddressProvider", () => {
  const provider = new StubAddressProvider();

  it("confirms a known Katy ZIP with a geocode", async () => {
    const result = await provider.validate({
      street: "123 Mason Rd",
      city: "Katy",
      state: "tx",
      zip: "77450",
    });
    expect(result.confidence).toBe("confirmed");
    expect(result.standardized.state).toBe("TX");
    expect(result.latitude).toBeDefined();
  });

  it("returns unresolved for a garbage address", async () => {
    const result = await provider.validate({
      street: "x",
      city: "Houston",
      state: "TX",
      zip: "abc",
    });
    expect(result.confidence).toBe("unresolved");
  });
});

describe("HaversineRouteProvider", () => {
  it("estimates Katy → Pearland as a substantial drive", async () => {
    const provider = new HaversineRouteProvider();
    const estimate = await provider.travelEstimate(
      { latitude: 29.745, longitude: -95.735 }, // Katy
      { latitude: 29.55, longitude: -95.35 }, // Pearland
    );
    expect(estimate.minutes).toBeGreaterThan(30);
    expect(estimate.fromRouteEngine).toBe(false);
  });
});
