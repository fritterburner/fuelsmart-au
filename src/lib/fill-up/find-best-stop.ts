/**
 * Pure logic for the Fill-Up Finder.
 *
 * Given two points (A, B), a fuel type, a fill size and consumption figure,
 * find the station that minimises total cost of (fill + detour fuel burned).
 *
 * Dependencies — OSRM routing — are injected so this file can be tested
 * without touching the network.
 */

import type { Station, FuelCode } from "../types";
import { FUEL_FALLBACKS } from "../fuel-codes";
import { haversine } from "../trip-planner";
import { OsrmThrottledError, type OsrmResult } from "./osrm";

// --- Public types ---------------------------------------------------------

export interface LatLng {
  lat: number;
  lng: number;
}

export interface FindBestStopInput {
  a: LatLng;
  b: LatLng;
  stations: Station[];
  /** Primary fuel from the UI — fallbacks applied automatically if empty. */
  fuel: FuelCode;
  /** Litres to fill (default callsite uses settings.tankSize). */
  fillLitres: number;
  /** L/100km from user settings. */
  consumption: number;
}

export interface CandidateResult {
  station: Station;
  priceCpl: number;
  detourKm: number;
  fillCostAud: number;
  detourFuelCostAud: number;
  /** fillCostAud + detourFuelCostAud. */
  totalCostAud: number;
  /** viaRoute geometry, so the UI can draw the winner's path. */
  geometry: [number, number][];
}

export interface FindBestStopResult {
  directKm: number;
  /** Fuel actually used (may be a fallback). */
  fuelUsed: FuelCode;
  /** Set when we fell back from `input.fuel` to a substitute. */
  fallbackNotice: string | null;
  winner: CandidateResult | null;
  shortlist: CandidateResult[];
  /** Lowest-total-cost candidate with ~0 detour — used for "savings vs on-route" framing. */
  onRouteCheapest: CandidateResult | null;
  /** winner.total − onRouteCheapest.total (negative means winner is worse; shouldn't happen but clamp in UI). */
  savingsVsOnRoute: number;
}

export interface FindBestStopDeps {
  osrmRoute: (coords: [number, number][]) => Promise<OsrmResult>;
}

// --- Tuning constants -----------------------------------------------------

const CORRIDOR_PERP_KM = 15; // stations within this distance of the A-B line are candidates
const BBOX_MARGIN_KM = 20; // quick reject anything outside this padded box
const MAX_CORRIDOR_CANDIDATES = 200; // protect OSRM against very long routes
const MAX_OSRM_CANDIDATES = 15; // top-N by raw c/L before paying for via-routes
const ON_ROUTE_DETOUR_KM = 0.5; // anything ≤ this detour is considered "on-route"
export const OSRM_CONCURRENCY = 4; // max parallel OSRM calls — router.project-osrm.org demo bursts above this trigger 429
export const OSRM_RETRY_BACKOFF_MS = 1500; // wait this long before retrying a 429 once

// --- Concurrency + retry helpers ------------------------------------------

/**
 * Run `fn` over `inputs` with at most `concurrency` promises in flight at once.
 * Preserves output order; individual failures bubble up and abort remaining
 * work (matches `Promise.all` semantics).
 */
export async function mapWithConcurrency<I, O>(
  inputs: I[],
  concurrency: number,
  fn: (input: I, index: number) => Promise<O>,
): Promise<O[]> {
  if (inputs.length === 0) return [];
  const results: O[] = new Array(inputs.length);
  let cursor = 0;
  let rejected = false;
  async function worker() {
    while (!rejected) {
      const i = cursor++;
      if (i >= inputs.length) return;
      results[i] = await fn(inputs[i], i);
    }
  }
  const workerCount = Math.max(1, Math.min(concurrency, inputs.length));
  try {
    await Promise.all(Array.from({ length: workerCount }, worker));
  } catch (e) {
    rejected = true;
    throw e;
  }
  return results;
}

/**
 * Run an OSRM call once, and if it throws `OsrmThrottledError`, wait
 * `OSRM_RETRY_BACKOFF_MS` and try exactly once more. Any non-throttle
 * error bubbles up immediately.
 */
export async function osrmWithRetry(
  routeFn: (coords: [number, number][]) => Promise<OsrmResult>,
  coords: [number, number][],
  sleep: (ms: number) => Promise<void> = defaultSleep,
): Promise<OsrmResult> {
  try {
    return await routeFn(coords);
  } catch (e) {
    if (e instanceof OsrmThrottledError) {
      await sleep(OSRM_RETRY_BACKOFF_MS);
      return await routeFn(coords);
    }
    throw e;
  }
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Entry point ----------------------------------------------------------

export async function findBestStop(
  input: FindBestStopInput,
  deps: FindBestStopDeps,
): Promise<FindBestStopResult> {
  const { a, b, stations, fuel, fillLitres, consumption } = input;

  // 1. Resolve fuel + fallback chain.
  const { fuelUsed, pool, fallbackNotice } = resolveFuel(stations, fuel);

  // 2. Corridor filter (cheap): bbox + perpendicular distance to A-B line.
  const corridor = filterCorridor(pool, a, b).slice(0, MAX_CORRIDOR_CANDIDATES);

  // 3. Top-N by c/L.
  const priced = corridor
    .map((s) => {
      const entry = s.prices.find((p) => p.fuel === fuelUsed);
      return entry ? { station: s, priceCpl: entry.price } : null;
    })
    .filter((x): x is { station: Station; priceCpl: number } => x != null);

  priced.sort((x, y) => x.priceCpl - y.priceCpl);
  const topCandidates = priced.slice(0, MAX_OSRM_CANDIDATES);

  // 4. Direct route (retry once on 429).
  const direct = await osrmWithRetry(deps.osrmRoute, [
    [a.lat, a.lng],
    [b.lat, b.lng],
  ]);
  const directKm = direct.distanceKm;

  if (topCandidates.length === 0) {
    return {
      directKm,
      fuelUsed,
      fallbackNotice,
      winner: null,
      shortlist: [],
      onRouteCheapest: null,
      savingsVsOnRoute: 0,
    };
  }

  // 5. Via-route per candidate, capped at OSRM_CONCURRENCY in flight,
  //    each call retried once on 429. Sequencing prevents self-inflicted
  //    bursts on the public OSRM demo server.
  const candidates: CandidateResult[] = await mapWithConcurrency(
    topCandidates,
    OSRM_CONCURRENCY,
    async ({ station, priceCpl }) => {
      const via = await osrmWithRetry(deps.osrmRoute, [
        [a.lat, a.lng],
        [station.lat, station.lng],
        [b.lat, b.lng],
      ]);
      // Clamp to 0 — OSRM routing quirks can occasionally make via-distance
      // slightly shorter than direct due to graph simplification.
      const detourKm = Math.max(0, via.distanceKm - directKm);
      const detourFuelCostAud =
        (detourKm * consumption) / 100 * (priceCpl / 100);
      const fillCostAud = (fillLitres * priceCpl) / 100;
      return {
        station,
        priceCpl,
        detourKm,
        fillCostAud,
        detourFuelCostAud,
        totalCostAud: fillCostAud + detourFuelCostAud,
        geometry: via.geometry,
      };
    },
  );

  // 6. Rank by total cost.
  candidates.sort((x, y) => x.totalCostAud - y.totalCostAud);

  const winner = candidates[0];
  const shortlist = candidates.slice(1, 5);
  const onRouteCheapest =
    candidates.find((c) => c.detourKm <= ON_ROUTE_DETOUR_KM) ?? null;
  const savingsVsOnRoute = onRouteCheapest
    ? onRouteCheapest.totalCostAud - winner.totalCostAud
    : 0;

  return {
    directKm,
    fuelUsed,
    fallbackNotice,
    winner,
    shortlist,
    onRouteCheapest,
    savingsVsOnRoute,
  };
}

// --- Helpers --------------------------------------------------------------

function resolveFuel(
  stations: Station[],
  fuel: FuelCode,
): { fuelUsed: FuelCode; pool: Station[]; fallbackNotice: string | null } {
  const primaryPool = stations.filter((s) =>
    s.prices.some((p) => p.fuel === fuel),
  );
  if (primaryPool.length > 0) {
    return { fuelUsed: fuel, pool: primaryPool, fallbackNotice: null };
  }
  const chain = FUEL_FALLBACKS[fuel] ?? [];
  for (const alt of chain) {
    const altPool = stations.filter((s) =>
      s.prices.some((p) => p.fuel === alt),
    );
    if (altPool.length > 0) {
      return {
        fuelUsed: alt,
        pool: altPool,
        fallbackNotice: `${fuel} not available along this route — showing ${alt} instead.`,
      };
    }
  }
  return { fuelUsed: fuel, pool: [], fallbackNotice: null };
}

function filterCorridor(stations: Station[], a: LatLng, b: LatLng): Station[] {
  const minLat = Math.min(a.lat, b.lat) - BBOX_MARGIN_KM / 111;
  const maxLat = Math.max(a.lat, b.lat) + BBOX_MARGIN_KM / 111;
  const avgLat = (a.lat + b.lat) / 2;
  const lngScale = Math.cos((avgLat * Math.PI) / 180);
  const lngMargin = BBOX_MARGIN_KM / 111 / (lngScale || 1);
  const minLng = Math.min(a.lng, b.lng) - lngMargin;
  const maxLng = Math.max(a.lng, b.lng) + lngMargin;

  return stations.filter((s) => {
    if (s.lat < minLat || s.lat > maxLat) return false;
    if (s.lng < minLng || s.lng > maxLng) return false;
    return perpDistanceKm(s.lat, s.lng, a, b) <= CORRIDOR_PERP_KM;
  });
}

/**
 * Perpendicular great-circle distance from point P to the A-B line,
 * projected in simple equirectangular space (good enough at intra-state
 * distances; the corridor is 15 km wide, any projection error is smaller
 * than the tolerance).
 */
export function perpDistanceKm(
  pLat: number,
  pLng: number,
  a: LatLng,
  b: LatLng,
): number {
  const dx = b.lat - a.lat;
  const dy = b.lng - a.lng;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return haversine(pLat, pLng, a.lat, a.lng);
  const t = Math.max(0, Math.min(1, ((pLat - a.lat) * dx + (pLng - a.lng) * dy) / lenSq));
  const projLat = a.lat + t * dx;
  const projLng = a.lng + t * dy;
  return haversine(pLat, pLng, projLat, projLng);
}
