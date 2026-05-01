/**
 * Routing facade — try OSRM first, fall back to OpenRouteService.
 *
 * OSRM (router.project-osrm.org) is the public demo server: free, no key,
 * but flaky. `osrmFetch` already retries once on 5xx. If that still fails —
 * or if OSRM rate-limits us with 429 — we fall through to OpenRouteService
 * provided `OPENROUTESERVICE_API_KEY` is configured. ORS has a 2,000/day
 * evaluation tier which is comfortable for our hobby traffic.
 *
 * Callers that just need a road route between N points should depend on this
 * module, not on the underlying providers.
 */
import { osrmFetch } from "@/lib/osrm-fetch";

export interface RouteResult {
  /** Driving distance in metres. */
  distanceMeters: number;
  /** Driving duration in seconds. */
  durationSeconds: number;
  /** Polyline as [lat, lng] pairs (ready for Leaflet). */
  geometryLatLng: [number, number][];
  /** Which provider answered — useful for logging / observability. */
  provider: "osrm" | "ors";
}

/**
 * Thrown when every routing provider in the chain refused us — typically
 * because OSRM is throttling and ORS is unconfigured (or also failed).
 * Callers can show the user a "try again" message.
 */
export class RouteThrottledError extends Error {
  constructor(message?: string) {
    super(
      message ??
        "All routing providers are temporarily unavailable — try again in a minute or two.",
    );
    this.name = "RouteThrottledError";
  }
}

const OSRM_BASE = "https://router.project-osrm.org";
const ORS_URL =
  "https://api.openrouteservice.org/v2/directions/driving-car/geojson";

/**
 * Get a road route through `coordsLatLng` (≥2 points, in [lat, lng] order).
 * Throws `RouteThrottledError` if all providers fail.
 */
export async function getRoute(
  coordsLatLng: [number, number][],
): Promise<RouteResult> {
  if (coordsLatLng.length < 2) {
    throw new Error(`getRoute: need ≥2 coords, got ${coordsLatLng.length}`);
  }

  const osrmAttempt = await tryOsrm(coordsLatLng);
  if (osrmAttempt.kind === "ok") return osrmAttempt.result;

  const orsAttempt = await tryOrs(coordsLatLng);
  if (orsAttempt.kind === "ok") return orsAttempt.result;

  // Both failed. If either was a throttle / transient, surface that to the UI
  // so it can offer a retry button rather than a generic error.
  if (
    osrmAttempt.kind === "throttled" ||
    osrmAttempt.kind === "transient" ||
    orsAttempt.kind === "throttled" ||
    orsAttempt.kind === "transient"
  ) {
    throw new RouteThrottledError();
  }

  // Hard failure — propagate the OSRM error since ORS likely wasn't configured.
  throw new Error(
    osrmAttempt.kind === "error"
      ? osrmAttempt.message
      : "Routing failed: no provider could service the request.",
  );
}

// --- Provider attempts ----------------------------------------------------

type ProviderAttempt =
  | { kind: "ok"; result: RouteResult }
  | { kind: "throttled" } // 429 or upstream rate limit
  | { kind: "transient"; message: string } // 5xx after retry
  | { kind: "error"; message: string } // hard failure (4xx, no route, etc.)
  | { kind: "skipped" }; // not configured

async function tryOsrm(
  coordsLatLng: [number, number][],
): Promise<ProviderAttempt> {
  const path = coordsLatLng.map(([lat, lng]) => `${lng},${lat}`).join(";");
  const url = `${OSRM_BASE}/route/v1/driving/${path}?overview=full&geometries=geojson`;

  let resp: Response;
  try {
    resp = await osrmFetch(url);
  } catch (e) {
    return { kind: "transient", message: `OSRM network: ${(e as Error).message}` };
  }

  if (resp.status === 429) return { kind: "throttled" };
  if (resp.status >= 500) {
    return { kind: "transient", message: `OSRM HTTP ${resp.status}` };
  }
  if (!resp.ok) return { kind: "error", message: `OSRM HTTP ${resp.status}` };

  let data: {
    code?: string;
    routes?: Array<{
      distance: number;
      duration: number;
      geometry: { coordinates: [number, number][] };
    }>;
  };
  try {
    data = await resp.json();
  } catch (e) {
    return { kind: "error", message: `OSRM bad JSON: ${(e as Error).message}` };
  }

  const route = data.routes?.[0];
  if (data.code !== "Ok" || !route) {
    return { kind: "error", message: `OSRM no route: ${data.code ?? "unknown"}` };
  }

  return {
    kind: "ok",
    result: {
      distanceMeters: route.distance,
      durationSeconds: route.duration,
      geometryLatLng: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      provider: "osrm",
    },
  };
}

async function tryOrs(
  coordsLatLng: [number, number][],
): Promise<ProviderAttempt> {
  const apiKey = process.env.OPENROUTESERVICE_API_KEY;
  if (!apiKey) return { kind: "skipped" };

  const body = {
    coordinates: coordsLatLng.map(([lat, lng]) => [lng, lat]),
  };

  let resp: Response;
  try {
    resp = await fetch(ORS_URL, {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
        Accept: "application/geo+json",
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return { kind: "transient", message: `ORS network: ${(e as Error).message}` };
  }

  if (resp.status === 429) return { kind: "throttled" };
  if (resp.status >= 500) {
    return { kind: "transient", message: `ORS HTTP ${resp.status}` };
  }
  if (!resp.ok) {
    let text = "";
    try {
      text = (await resp.text()).slice(0, 200);
    } catch {
      // ignore — best-effort error context
    }
    return { kind: "error", message: `ORS HTTP ${resp.status}${text ? `: ${text}` : ""}` };
  }

  let data: {
    features?: Array<{
      geometry?: { coordinates?: [number, number][] };
      properties?: { summary?: { distance?: number; duration?: number } };
    }>;
  };
  try {
    data = await resp.json();
  } catch (e) {
    return { kind: "error", message: `ORS bad JSON: ${(e as Error).message}` };
  }

  const feature = data.features?.[0];
  const summary = feature?.properties?.summary;
  const coords = feature?.geometry?.coordinates;
  if (
    !summary ||
    typeof summary.distance !== "number" ||
    typeof summary.duration !== "number" ||
    !coords?.length
  ) {
    return { kind: "error", message: "ORS returned no usable route geometry" };
  }

  return {
    kind: "ok",
    result: {
      distanceMeters: summary.distance,
      durationSeconds: summary.duration,
      geometryLatLng: coords.map(([lng, lat]) => [lat, lng]),
      provider: "ors",
    },
  };
}
