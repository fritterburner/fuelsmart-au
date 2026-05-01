/**
 * Routing client used by the Fill-Up Finder.
 *
 * Delegates to the shared `getRoute` facade (OSRM primary, OpenRouteService
 * fallback) but preserves the historical `osrmRoute` / `OsrmThrottledError`
 * surface so `/api/fill-up` and the find-best-stop tests don't have to change.
 *
 * The `overview` option is kept for source-level compatibility but is currently
 * ignored — `getRoute` always returns full geometry. The wasted bandwidth on
 * the per-candidate via-routes is negligible at our traffic level.
 */

import { getRoute, RouteThrottledError } from "@/lib/routing/get-route";

export const OSRM_BASE = "https://router.project-osrm.org";

/**
 * Thrown when every routing provider in the fallback chain refused us
 * (typically OSRM returned 429 and ORS is unconfigured or also throttled).
 * Name retained for backwards compatibility — covers the ORS path now too.
 */
export class OsrmThrottledError extends Error {
  constructor() {
    super(
      "The public routing service is temporarily throttling us — try again in a minute or two.",
    );
    this.name = "OsrmThrottledError";
  }
}

export interface OsrmResult {
  distanceKm: number;
  durationMin: number;
  /** [lat, lng] pairs (already flipped from OSRM's lng,lat for Leaflet). */
  geometry: [number, number][];
}

/**
 * Route through `coords` in order. Need ≥2 points, all in [lat, lng] order.
 *
 * Throws `OsrmThrottledError` when every provider in the chain is unavailable;
 * any other failure (no route, malformed response) throws a generic `Error`.
 */
export async function osrmRoute(
  coords: [number, number][],
  _opts?: { overview?: "full" | "simplified" | "false" },
): Promise<OsrmResult> {
  if (coords.length < 2) {
    throw new Error(`osrmRoute: need ≥2 coords, got ${coords.length}`);
  }

  try {
    const route = await getRoute(coords);
    return {
      distanceKm: route.distanceMeters / 1000,
      durationMin: route.durationSeconds / 60,
      geometry: route.geometryLatLng,
    };
  } catch (e) {
    if (e instanceof RouteThrottledError) throw new OsrmThrottledError();
    throw e;
  }
}
