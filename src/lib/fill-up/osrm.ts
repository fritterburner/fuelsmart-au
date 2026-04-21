/**
 * Thin client for the public OSRM routing server.
 *
 * Used by the Fill-Up Finder (`/api/fill-up`) for both the direct A→B route
 * and the per-candidate A→station→B via-routes that let us cost each detour.
 *
 * No retry / no rate-limit handling — failures bubble up so the caller can
 * return 503 and let the UI decide what to do.
 */

export const OSRM_BASE = "https://router.project-osrm.org";

/**
 * Thrown when OSRM returns 429. The public demo server is heavily
 * rate-limited and has no SLA — see https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server.
 * API routes should return 429 with an actionable message when they catch this.
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
 * Route through `coords` in order. OSRM requires at least 2 points.
 * Coords are [lat, lng] for consistency with the rest of our codebase; this
 * function flips them for the OSRM wire format internally.
 */
export async function osrmRoute(
  coords: [number, number][],
  opts?: { overview?: "full" | "simplified" | "false" },
): Promise<OsrmResult> {
  if (coords.length < 2) {
    throw new Error(`osrmRoute: need ≥2 coords, got ${coords.length}`);
  }
  const overview = opts?.overview ?? "full";
  const path = coords.map(([lat, lng]) => `${lng},${lat}`).join(";");
  const url = `${OSRM_BASE}/route/v1/driving/${path}?overview=${overview}&geometries=geojson`;

  const resp = await fetch(url);
  if (!resp.ok) {
    if (resp.status === 429) {
      throw new OsrmThrottledError();
    }
    throw new Error(`OSRM HTTP ${resp.status}`);
  }
  const data = await resp.json();
  if (data.code !== "Ok" || !data.routes?.[0]) {
    throw new Error(`OSRM no route: ${data.code ?? "unknown"}`);
  }
  const route = data.routes[0];
  const geometry: [number, number][] =
    overview === "false"
      ? []
      : (route.geometry.coordinates as [number, number][]).map(([lng, lat]) => [lat, lng]);

  return {
    distanceKm: route.distance / 1000,
    durationMin: route.duration / 60,
    geometry,
  };
}
