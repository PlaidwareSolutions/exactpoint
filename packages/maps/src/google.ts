import type {
  AddressInput,
  AddressProvider,
  LatLng,
  RouteProvider,
  TravelEstimate,
  ValidatedAddress,
} from "./types";
import { haversineKm, HaversineRouteProvider } from "./stub";

type FetchLike = typeof fetch;

/**
 * Google Address Validation API provider (spec §9). Fetch-based — no SDK —
 * and constructed only where the server key is present, so the key never
 * reaches client code.
 */
export class GoogleAddressProvider implements AddressProvider {
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  async validate(input: AddressInput): Promise<ValidatedAddress> {
    const line = `${input.street}${input.unit ? ` ${input.unit}` : ""}, ${input.city}, ${input.state} ${input.zip}`;
    const res = await this.fetchImpl(
      `https://addressvalidation.googleapis.com/v1:validateAddress?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: { regionCode: "US", addressLines: [line] },
        }),
      },
    );
    if (!res.ok) {
      throw new Error(`address validation ${res.status}`);
    }
    return parseValidateAddressResponse(await res.json(), input);
  }
}

/** Exported for tests. */
export function parseValidateAddressResponse(
  body: unknown,
  input: AddressInput,
): ValidatedAddress {
  const result = (body as { result?: GoogleValidationResult }).result;
  if (!result) {
    return { confidence: "unresolved", standardized: normalizeInput(input) };
  }
  const verdict = result.verdict ?? {};
  const granularity = verdict.validationGranularity ?? "OTHER";
  const location = result.geocode?.location;

  const components = result.address?.postalAddress;
  const standardized: AddressInput = components
    ? {
        street: components.addressLines?.[0] ?? input.street.trim(),
        unit: components.addressLines?.[1] || input.unit?.trim() || undefined,
        city: components.locality ?? input.city.trim(),
        state: components.administrativeArea ?? input.state.trim().toUpperCase(),
        zip: (components.postalCode ?? input.zip).slice(0, 5),
      }
    : normalizeInput(input);

  // PREMISE/SUB_PREMISE = rooftop-quality; ROUTE/BLOCK still usable but the
  // customer should re-check; anything coarser can't be trusted for dispatch.
  const confidence: ValidatedAddress["confidence"] =
    granularity === "PREMISE" || granularity === "SUB_PREMISE"
      ? "confirmed"
      : granularity === "ROUTE" || granularity === "BLOCK" || granularity === "PREMISE_PROXIMITY"
        ? "partial"
        : "unresolved";

  return {
    confidence,
    standardized,
    latitude: location?.latitude,
    longitude: location?.longitude,
    providerRaw: { granularity, formattedAddress: result.address?.formattedAddress },
  };
}

interface GoogleValidationResult {
  verdict?: { validationGranularity?: string; addressComplete?: boolean };
  geocode?: { location?: { latitude: number; longitude: number } };
  address?: {
    formattedAddress?: string;
    postalAddress?: {
      addressLines?: string[];
      locality?: string;
      administrativeArea?: string;
      postalCode?: string;
    };
  };
}

function normalizeInput(input: AddressInput): AddressInput {
  return {
    street: input.street.trim(),
    unit: input.unit?.trim() || undefined,
    city: input.city.trim(),
    state: input.state.trim().toUpperCase(),
    zip: input.zip.trim().slice(0, 5),
  };
}

/**
 * Google Routes API (Compute Route Matrix) provider (spec §15). Falls back
 * to the haversine heuristic on any API failure so scheduling never breaks
 * because of a vendor hiccup.
 */
export class GoogleRouteProvider implements RouteProvider {
  private readonly fallback = new HaversineRouteProvider();

  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  async travelEstimate(origin: LatLng, destination: LatLng): Promise<TravelEstimate> {
    const matrix = await this.travelMatrix([origin], [destination]);
    return matrix[0]![0]!;
  }

  async travelMatrix(origins: LatLng[], destinations: LatLng[]): Promise<TravelEstimate[][]> {
    if (origins.length === 0 || destinations.length === 0) return [];
    try {
      const res = await this.fetchImpl(
        "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": this.apiKey,
            "X-Goog-FieldMask": "originIndex,destinationIndex,duration,distanceMeters,condition",
          },
          body: JSON.stringify({
            origins: origins.map(waypoint),
            destinations: destinations.map(waypoint),
            travelMode: "DRIVE",
            routingPreference: "TRAFFIC_UNAWARE",
          }),
        },
      );
      if (!res.ok) throw new Error(`route matrix ${res.status}`);
      return parseRouteMatrixResponse(await res.json(), origins, destinations);
    } catch (err) {
      console.error("[maps] route matrix failed; using haversine fallback", err);
      return this.fallback.travelMatrix(origins, destinations);
    }
  }
}

function waypoint(p: LatLng) {
  return { waypoint: { location: { latLng: { latitude: p.latitude, longitude: p.longitude } } } };
}

/** Exported for tests. Unroutable pairs fall back to the haversine heuristic. */
export function parseRouteMatrixResponse(
  body: unknown,
  origins: LatLng[],
  destinations: LatLng[],
): TravelEstimate[][] {
  const grid: TravelEstimate[][] = origins.map((o) =>
    destinations.map((d) => heuristicEstimate(o, d)),
  );
  const elements = Array.isArray(body) ? body : [];
  for (const el of elements as {
    originIndex?: number;
    destinationIndex?: number;
    duration?: string;
    distanceMeters?: number;
    condition?: string;
  }[]) {
    const oi = el.originIndex ?? -1;
    const di = el.destinationIndex ?? -1;
    if (oi < 0 || di < 0 || !grid[oi] || !grid[oi][di]) continue;
    if (el.condition !== "ROUTE_EXISTS" || !el.duration) continue;
    grid[oi][di] = {
      minutes: Math.max(1, Math.round(Number(el.duration.replace("s", "")) / 60)),
      distanceKm: Math.round(((el.distanceMeters ?? 0) / 1000) * 10) / 10,
      fromRouteEngine: true,
    };
  }
  return grid;
}

function heuristicEstimate(a: LatLng, b: LatLng): TravelEstimate {
  const distanceKm = haversineKm(a, b) * 1.35;
  return {
    minutes: Math.round((distanceKm / 45) * 60) + 5,
    distanceKm: Math.round(distanceKm * 10) / 10,
    fromRouteEngine: false,
  };
}
