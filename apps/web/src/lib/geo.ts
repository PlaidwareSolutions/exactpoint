import {
  GoogleAddressProvider,
  GoogleRouteProvider,
  HaversineRouteProvider,
  StubAddressProvider,
  type AddressProvider,
  type RouteProvider,
} from "@exactpoint/maps";

/**
 * Geo provider selection (spec §84): Google when the server key is present,
 * deterministic stubs otherwise (dev/test without credentials). The server
 * key never reaches client code — only NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY
 * is exposed, restricted to Maps JavaScript by referrer.
 */
const serverKey = process.env.GOOGLE_MAPS_SERVER_KEY;

export const usingGoogleGeo = Boolean(serverKey);

export const addressProvider: AddressProvider = serverKey
  ? new GoogleAddressProvider(serverKey)
  : new StubAddressProvider();

export const routeProvider: RouteProvider = serverKey
  ? new GoogleRouteProvider(serverKey)
  : new HaversineRouteProvider();
