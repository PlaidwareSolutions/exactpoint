/**
 * Vendor-neutral geographic provider interfaces (spec §84). Business code
 * depends only on these; Google implementations arrive in Phase 6/7 when
 * API keys are supplied. Dev/test uses the stub implementations.
 */

export interface AddressInput {
  street: string;
  unit?: string;
  city: string;
  state: string;
  zip: string;
}

export type AddressConfidence = "confirmed" | "partial" | "unresolved";

export interface ValidatedAddress {
  confidence: AddressConfidence;
  standardized: AddressInput;
  latitude?: number;
  longitude?: number;
  providerRaw?: unknown;
}

export interface AddressProvider {
  validate(input: AddressInput): Promise<ValidatedAddress>;
}

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface TravelEstimate {
  minutes: number;
  distanceKm: number;
  /** True when derived from a real routing engine, false for heuristics. */
  fromRouteEngine: boolean;
}

export interface RouteProvider {
  travelEstimate(origin: LatLng, destination: LatLng): Promise<TravelEstimate>;
  /** Row-major matrix: result[i][j] = travel from origins[i] to destinations[j]. */
  travelMatrix(origins: LatLng[], destinations: LatLng[]): Promise<TravelEstimate[][]>;
}
