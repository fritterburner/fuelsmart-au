import type { FuelCode, TripComparison, TripStop } from "./types";
import { haversine } from "./trip-planner";

export interface ItineraryStop {
  label: string;
  lat: number;
  lng: number;
  /** Nights camped here. 0 for the start and the destination. */
  nights: number;
}

export interface ItineraryPreset {
  id: string;
  name: string;
  approxKm: number | null;
  stops: ItineraryStop[];
}

export interface ItineraryVehicle {
  fuel: FuelCode;
  tank: number; // litres
  consumption: number; // L/100 km, towing figure
  jerry: number; // litres carried in cans
  reservePct: number; // % of tank + jerries kept as reserve
  startFuelPct: number; // % full when leaving the first stop
}

export interface ItineraryState {
  v: 1;
  presetId: string | null;
  stops: ItineraryStop[];
  vehicle: ItineraryVehicle;
  /** YYYY-MM-DD; the day you leave the first stop. */
  departureDate?: string;
  updatedAt: string;
}

export const STORAGE_KEY = "fuelsmart-itinerary-v1";

/** RAV4 + hard-top camper, as the Trip Planner artifact holds it. */
export const DEFAULT_VEHICLE: ItineraryVehicle = {
  fuel: "U91",
  tank: 45,
  consumption: 12,
  jerry: 40,
  reservePct: 10,
  startFuelPct: 100,
};

export function loadItinerary(): ItineraryState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ItineraryState;
    if (parsed?.v !== 1 || !Array.isArray(parsed.stops)) return null;
    return { ...parsed, vehicle: { ...DEFAULT_VEHICLE, ...parsed.vehicle } };
  } catch {
    return null;
  }
}

export function saveItinerary(state: Omit<ItineraryState, "v" | "updatedAt">): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...state, v: 1, updatedAt: new Date().toISOString() }),
    );
  } catch {
    // storage unavailable (private mode, quota) — the page still works in memory
  }
}

/** Build the /api/trip-plan query for an itinerary. */
export function buildTripPlanParams(
  stops: ItineraryStop[],
  vehicle: ItineraryVehicle,
  discountsJson?: string,
): URLSearchParams {
  const origin = stops[0];
  const dest = stops[stops.length - 1];
  const params = new URLSearchParams({
    origin: `${origin.lat},${origin.lng}`,
    dest: `${dest.lat},${dest.lng}`,
    fuel: vehicle.fuel,
    tank: String(vehicle.tank),
    consumption: String(vehicle.consumption),
    jerry: String(vehicle.jerry),
    startFuel: String(vehicle.startFuelPct),
    reservePct: String(vehicle.reservePct),
  });
  const via = stops.slice(1, -1);
  if (via.length > 0) params.set("via", via.map((s) => `${s.lat},${s.lng}`).join("|"));
  if (discountsJson) params.set("discounts", discountsJson);
  return params;
}

/**
 * Where along the planned route each itinerary stop falls, in km from the
 * start. Each stop is a routing waypoint, so it sits on the geometry; we take
 * the nearest vertex and scale cumulative haversine length to the router's
 * total so the figures line up with TripStop.distanceFromStart.
 */
export function stopsAlongRoute(
  stops: ItineraryStop[],
  geometry: [number, number][],
  totalDistanceKm: number,
): number[] {
  if (geometry.length < 2) return stops.map(() => 0);
  const cum: number[] = [0];
  for (let i = 1; i < geometry.length; i++) {
    cum.push(cum[i - 1] + haversine(geometry[i - 1][0], geometry[i - 1][1], geometry[i][0], geometry[i][1]));
  }
  const scale = cum[cum.length - 1] > 0 ? totalDistanceKm / cum[cum.length - 1] : 1;
  // Waypoints are visited in order, so search forward from the previous match
  // — stops that the route passes twice (out-and-back spurs) resolve correctly.
  let from = 0;
  return stops.map((s, idx) => {
    if (idx === stops.length - 1) return totalDistanceKm;
    let best = Infinity;
    let bi = from;
    for (let i = from; i < geometry.length; i++) {
      const d = haversine(s.lat, s.lng, geometry[i][0], geometry[i][1]);
      if (d < best) {
        best = d;
        bi = i;
      }
    }
    from = bi;
    return cum[bi] * scale;
  });
}

export interface ItineraryLeg {
  from: ItineraryStop;
  to: ItineraryStop;
  startKm: number;
  endKm: number;
  km: number;
  fills: TripStop[];
}

/** Group a strategy's fill stops by the itinerary leg they fall in. */
export function groupFillsByLeg(
  stops: ItineraryStop[],
  comparison: TripComparison,
  fills: TripStop[],
): ItineraryLeg[] {
  const along = stopsAlongRoute(stops, comparison.routeGeometry, comparison.totalDistance);
  const legs: ItineraryLeg[] = [];
  for (let i = 0; i < stops.length - 1; i++) {
    const startKm = along[i];
    const endKm = along[i + 1];
    legs.push({
      from: stops[i],
      to: stops[i + 1],
      startKm,
      endKm,
      km: Math.max(0, endKm - startKm),
      fills: fills.filter((f) =>
        i === stops.length - 2
          ? f.distanceFromStart > startKm - 0.5
          : f.distanceFromStart > startKm - 0.5 && f.distanceFromStart <= endKm + 0.5,
      ),
    });
  }
  return legs;
}

/** Usable range on a full tank (+ cans) after reserve, km. */
export function rangeKm(vehicle: ItineraryVehicle, withJerry: boolean): number {
  const capacity = vehicle.tank + (withJerry ? vehicle.jerry : 0);
  const usable = capacity * (1 - vehicle.reservePct / 100);
  return (usable / vehicle.consumption) * 100;
}

// ─── Routing on edit ────────────────────────────────────────────────────────

export interface RouteLegKm {
  km: number;
  minutes: number; // router's car estimate
}

export interface RoutePlan {
  hash: string;
  distanceKm: number;
  durationMin: number;
  geometry: [number, number][];
  legs: RouteLegKm[];
  provider: string;
  fetchedAt: string;
}

export const ROUTE_CACHE_KEY = "fuelsmart-itinerary-route-v1";

/** Stable key for a stop sequence — only coordinates matter to the router. */
export function waypointHash(stops: ItineraryStop[]): string {
  return stops.map((s) => `${s.lat.toFixed(4)},${s.lng.toFixed(4)}`).join("|");
}

export function buildRouteParams(stops: ItineraryStop[]): URLSearchParams {
  const origin = stops[0];
  const dest = stops[stops.length - 1];
  const params = new URLSearchParams({
    origin: `${origin.lat},${origin.lng}`,
    dest: `${dest.lat},${dest.lng}`,
  });
  const via = stops.slice(1, -1);
  if (via.length > 0) params.set("via", via.map((s) => `${s.lat},${s.lng}`).join("|"));
  return params;
}

export function loadRouteCache(): RoutePlan | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ROUTE_CACHE_KEY);
    if (!raw) return null;
    const r = JSON.parse(raw) as RoutePlan;
    return Array.isArray(r?.geometry) && Array.isArray(r?.legs) ? r : null;
  } catch {
    return null;
  }
}

export function saveRouteCache(route: RoutePlan): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ROUTE_CACHE_KEY, JSON.stringify(route));
  } catch {
    // quota or private mode — the route still lives in memory for this visit
  }
}

// ─── Schedule (dates per leg) ───────────────────────────────────────────────

/** Towing time rule carried over from the Trip Planner: km / 80 km/h + 15 min per leg. */
export const TOWING_KMH = 80;
export const LEG_OVERHEAD_MIN = 15;

export function towingMinutes(km: number): number {
  return (km / TOWING_KMH) * 60 + LEG_OVERHEAD_MIN;
}

export interface ScheduledLeg {
  index: number;
  from: ItineraryStop;
  to: ItineraryStop;
  km: number;
  routerMinutes: number;
  towingMinutes: number;
  /** Calendar date (YYYY-MM-DD) the leg is driven. */
  date: string;
  startKm: number;
  endKm: number;
  fills: TripStop[];
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function formatDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
}

/**
 * One scheduled leg per stop pair. Leg i is driven on the day you leave stop i,
 * which is the day you arrived there plus that stop's nights. Legs are assumed
 * to complete the same day (no leg on this trip exceeds a driving day).
 */
export function buildSchedule(
  stops: ItineraryStop[],
  departureDate: string,
  legs: RouteLegKm[],
  fills: TripStop[] = [],
): ScheduledLeg[] {
  const out: ScheduledLeg[] = [];
  let date = departureDate;
  let cum = 0;
  for (let i = 0; i < stops.length - 1; i++) {
    const leg = legs[i];
    const km = leg?.km ?? 0;
    const startKm = cum;
    const endKm = cum + km;
    const last = i === stops.length - 2;
    out.push({
      index: i,
      from: stops[i],
      to: stops[i + 1],
      km,
      routerMinutes: leg?.minutes ?? 0,
      towingMinutes: towingMinutes(km),
      date,
      startKm,
      endKm,
      fills: fills.filter((f) =>
        last
          ? f.distanceFromStart > startKm - 0.5
          : f.distanceFromStart > startKm - 0.5 && f.distanceFromStart <= endKm + 0.5,
      ),
    });
    cum = endKm;
    date = addDays(date, stops[i + 1].nights || 0);
  }
  return out;
}

export function arrivalDate(stops: ItineraryStop[], departureDate: string): string {
  const nights = stops.slice(1, -1).reduce((a, s) => a + (s.nights || 0), 0);
  return addDays(departureDate, nights);
}
