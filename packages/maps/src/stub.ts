import type {
  AddressInput,
  AddressProvider,
  LatLng,
  RouteProvider,
  TravelEstimate,
  ValidatedAddress,
} from "./types";

/**
 * Approximate centroids for Greater Houston ZIPs used by the dev stub.
 * Not exhaustive — unknown ZIPs come back "partial" with no geocode, which
 * exercises the booking flow's "please review this address" path.
 */
const ZIP_CENTROIDS: Record<string, LatLng> = {
  "77002": { latitude: 29.756, longitude: -95.365 }, // Downtown
  "77008": { latitude: 29.802, longitude: -95.411 }, // Heights
  "77024": { latitude: 29.772, longitude: -95.523 }, // Memorial
  "77077": { latitude: 29.749, longitude: -95.611 }, // Energy Corridor
  "77094": { latitude: 29.77, longitude: -95.7 }, // West Houston
  "77449": { latitude: 29.832, longitude: -95.735 }, // Katy N
  "77450": { latitude: 29.745, longitude: -95.735 }, // Katy / Cinco Ranch
  "77494": { latitude: 29.74, longitude: -95.83 }, // Katy SW
  "77429": { latitude: 29.99, longitude: -95.65 }, // Cypress
  "77433": { latitude: 29.94, longitude: -95.72 }, // Cypress W
  "77375": { latitude: 30.09, longitude: -95.62 }, // Tomball
  "77379": { latitude: 30.03, longitude: -95.53 }, // Klein/Spring
  "77380": { latitude: 30.13, longitude: -95.47 }, // The Woodlands S
  "77338": { latitude: 30.0, longitude: -95.27 }, // Humble
  "77339": { latitude: 30.05, longitude: -95.22 }, // Kingwood
  "77346": { latitude: 29.99, longitude: -95.17 }, // Atascocita
  "77520": { latitude: 29.74, longitude: -94.97 }, // Baytown
  "77530": { latitude: 29.79, longitude: -95.11 }, // Channelview
  "77478": { latitude: 29.62, longitude: -95.6 }, // Sugar Land
  "77479": { latitude: 29.57, longitude: -95.63 }, // Sugar Land S
  "77477": { latitude: 29.62, longitude: -95.56 }, // Stafford
  "77459": { latitude: 29.53, longitude: -95.54 }, // Missouri City
  "77581": { latitude: 29.56, longitude: -95.28 }, // Pearland E
  "77584": { latitude: 29.55, longitude: -95.35 }, // Pearland W
  "77502": { latitude: 29.68, longitude: -95.2 }, // Pasadena
  "77536": { latitude: 29.69, longitude: -95.12 }, // Deer Park
  "77058": { latitude: 29.57, longitude: -95.1 }, // Clear Lake
  "77573": { latitude: 29.5, longitude: -95.09 }, // League City
};

/** Deterministic dev/test stand-in for Google Address Validation. */
export class StubAddressProvider implements AddressProvider {
  async validate(input: AddressInput): Promise<ValidatedAddress> {
    const zip = input.zip.trim().slice(0, 5);
    const centroid = ZIP_CENTROIDS[zip];
    const standardized: AddressInput = {
      street: input.street.trim(),
      unit: input.unit?.trim() || undefined,
      city: input.city.trim(),
      state: input.state.trim().toUpperCase(),
      zip,
    };
    if (!/^\d{5}$/.test(zip) || standardized.street.length < 4) {
      return { confidence: "unresolved", standardized };
    }
    if (!centroid) {
      return { confidence: "partial", standardized };
    }
    return {
      confidence: "confirmed",
      standardized,
      latitude: centroid.latitude,
      longitude: centroid.longitude,
    };
  }
}

const EARTH_RADIUS_KM = 6371;

export function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/**
 * Heuristic travel estimates for dev/test: straight-line distance × 1.35
 * road factor at ~45 km/h Houston average, plus 5 minutes overhead.
 * Real driving times come from the Routes API provider in Phase 7.
 */
export class HaversineRouteProvider implements RouteProvider {
  async travelEstimate(origin: LatLng, destination: LatLng): Promise<TravelEstimate> {
    const distanceKm = haversineKm(origin, destination) * 1.35;
    return {
      minutes: Math.round((distanceKm / 45) * 60) + 5,
      distanceKm: Math.round(distanceKm * 10) / 10,
      fromRouteEngine: false,
    };
  }

  async travelMatrix(origins: LatLng[], destinations: LatLng[]): Promise<TravelEstimate[][]> {
    return Promise.all(
      origins.map((o) => Promise.all(destinations.map((d) => this.travelEstimate(o, d)))),
    );
  }
}
