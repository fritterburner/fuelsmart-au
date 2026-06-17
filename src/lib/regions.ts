import { Station, StateCode } from "./types";

/**
 * Named-region scheme. Each state = "Greater <Capital>" (metro, kept whole) plus
 * ABS-Significant-Urban-Area regional hubs. A station joins its NEAREST anchor in
 * the SAME state within that anchor's catchment; anything beyond every catchment
 * falls to "Rest of <state>". Classification is by lat/lng (works where the feed
 * has no postcode, e.g. WA).
 *
 * Coordinates are city-centre approximations (good to a few km — far finer than
 * the 30–300 km catchments need). Source for the hub *selection*: ABS Significant
 * Urban Areas / population (attribute ABS, CC-BY).
 */

export type RegionKind = "metro" | "regional" | "rest";

export interface RegionAnchor {
  id: string;
  label: string;
  state: StateCode;
  lat: number;
  lng: number;
  catchmentKm: number;
  kind: "metro" | "regional";
}

export interface Region {
  id: string;
  label: string;
  state: StateCode;
  kind: RegionKind;
}

/** Thin regions (fewer reporting stations than this on a given day) roll up into "Rest of <state>". */
export const MIN_REGION_STATIONS = 5;

export const REGION_ANCHORS: RegionAnchor[] = [
  // NSW
  { id: "nsw-sydney", label: "Greater Sydney", state: "NSW", lat: -33.87, lng: 151.21, catchmentKm: 70, kind: "metro" },
  { id: "nsw-central-coast", label: "Central Coast", state: "NSW", lat: -33.43, lng: 151.34, catchmentKm: 30, kind: "regional" },
  { id: "nsw-newcastle", label: "Newcastle & Hunter", state: "NSW", lat: -32.93, lng: 151.78, catchmentKm: 55, kind: "regional" },
  { id: "nsw-wollongong", label: "Wollongong & Illawarra", state: "NSW", lat: -34.42, lng: 150.89, catchmentKm: 40, kind: "regional" },
  { id: "nsw-south-coast", label: "South Coast (Nowra)", state: "NSW", lat: -34.88, lng: 150.6, catchmentKm: 70, kind: "regional" },
  { id: "nsw-northern-rivers", label: "Northern Rivers", state: "NSW", lat: -28.81, lng: 153.28, catchmentKm: 70, kind: "regional" },
  { id: "nsw-mid-north-coast", label: "Mid North Coast", state: "NSW", lat: -30.9, lng: 153.0, catchmentKm: 80, kind: "regional" },
  { id: "nsw-new-england", label: "New England", state: "NSW", lat: -31.09, lng: 150.93, catchmentKm: 110, kind: "regional" },
  { id: "nsw-central-west", label: "Central West", state: "NSW", lat: -32.8, lng: 148.9, catchmentKm: 130, kind: "regional" },
  { id: "nsw-riverina", label: "Riverina (Wagga Wagga)", state: "NSW", lat: -35.11, lng: 147.37, catchmentKm: 110, kind: "regional" },
  { id: "nsw-border", label: "Border (Albury)", state: "NSW", lat: -36.08, lng: 146.92, catchmentKm: 70, kind: "regional" },

  // VIC
  { id: "vic-melbourne", label: "Greater Melbourne", state: "VIC", lat: -37.81, lng: 144.96, catchmentKm: 70, kind: "metro" },
  { id: "vic-geelong", label: "Geelong", state: "VIC", lat: -38.15, lng: 144.36, catchmentKm: 40, kind: "regional" },
  { id: "vic-ballarat", label: "Ballarat", state: "VIC", lat: -37.56, lng: 143.85, catchmentKm: 60, kind: "regional" },
  { id: "vic-bendigo", label: "Bendigo", state: "VIC", lat: -36.76, lng: 144.28, catchmentKm: 70, kind: "regional" },
  { id: "vic-gippsland", label: "Gippsland (Latrobe Valley)", state: "VIC", lat: -38.2, lng: 146.54, catchmentKm: 90, kind: "regional" },
  { id: "vic-shepparton", label: "Goulburn (Shepparton)", state: "VIC", lat: -36.38, lng: 145.4, catchmentKm: 70, kind: "regional" },
  { id: "vic-mildura", label: "Mildura", state: "VIC", lat: -34.21, lng: 142.15, catchmentKm: 130, kind: "regional" },
  { id: "vic-warrnambool", label: "South West (Warrnambool)", state: "VIC", lat: -38.38, lng: 142.48, catchmentKm: 90, kind: "regional" },
  { id: "vic-wodonga", label: "Wodonga", state: "VIC", lat: -36.12, lng: 146.89, catchmentKm: 40, kind: "regional" },

  // QLD
  { id: "qld-brisbane", label: "Greater Brisbane", state: "QLD", lat: -27.47, lng: 153.03, catchmentKm: 60, kind: "metro" },
  { id: "qld-gold-coast", label: "Gold Coast", state: "QLD", lat: -28.0, lng: 153.43, catchmentKm: 35, kind: "regional" },
  { id: "qld-sunshine-coast", label: "Sunshine Coast", state: "QLD", lat: -26.65, lng: 153.07, catchmentKm: 45, kind: "regional" },
  { id: "qld-toowoomba", label: "Toowoomba & Darling Downs", state: "QLD", lat: -27.56, lng: 151.95, catchmentKm: 90, kind: "regional" },
  { id: "qld-wide-bay", label: "Wide Bay", state: "QLD", lat: -25.1, lng: 152.5, catchmentKm: 80, kind: "regional" },
  { id: "qld-gladstone", label: "Gladstone", state: "QLD", lat: -23.84, lng: 151.26, catchmentKm: 60, kind: "regional" },
  { id: "qld-rockhampton", label: "Rockhampton (Capricornia)", state: "QLD", lat: -23.38, lng: 150.51, catchmentKm: 90, kind: "regional" },
  { id: "qld-mackay", label: "Mackay", state: "QLD", lat: -21.14, lng: 149.19, catchmentKm: 100, kind: "regional" },
  { id: "qld-townsville", label: "Townsville", state: "QLD", lat: -19.26, lng: 146.82, catchmentKm: 100, kind: "regional" },
  { id: "qld-cairns", label: "Cairns (Far North)", state: "QLD", lat: -16.92, lng: 145.77, catchmentKm: 120, kind: "regional" },
  { id: "qld-mount-isa", label: "Mount Isa (North West)", state: "QLD", lat: -20.73, lng: 139.49, catchmentKm: 250, kind: "regional" },

  // SA
  { id: "sa-adelaide", label: "Greater Adelaide", state: "SA", lat: -34.93, lng: 138.6, catchmentKm: 60, kind: "metro" },
  { id: "sa-murray-bridge", label: "Murraylands (Murray Bridge)", state: "SA", lat: -35.12, lng: 139.27, catchmentKm: 60, kind: "regional" },
  { id: "sa-mount-gambier", label: "Limestone Coast (Mount Gambier)", state: "SA", lat: -37.83, lng: 140.78, catchmentKm: 110, kind: "regional" },
  { id: "sa-spencer-gulf", label: "Spencer Gulf (Whyalla–Pt Augusta)", state: "SA", lat: -32.8, lng: 137.65, catchmentKm: 100, kind: "regional" },
  { id: "sa-eyre", label: "Eyre Peninsula (Port Lincoln)", state: "SA", lat: -34.73, lng: 135.86, catchmentKm: 150, kind: "regional" },

  // WA
  { id: "wa-perth", label: "Greater Perth", state: "WA", lat: -31.95, lng: 115.86, catchmentKm: 65, kind: "metro" },
  { id: "wa-mandurah", label: "Mandurah (Peel)", state: "WA", lat: -32.53, lng: 115.72, catchmentKm: 30, kind: "regional" },
  { id: "wa-bunbury", label: "Bunbury (South West)", state: "WA", lat: -33.33, lng: 115.64, catchmentKm: 70, kind: "regional" },
  { id: "wa-albany", label: "Great Southern (Albany)", state: "WA", lat: -35.02, lng: 117.88, catchmentKm: 130, kind: "regional" },
  { id: "wa-geraldton", label: "Mid West (Geraldton)", state: "WA", lat: -28.77, lng: 114.61, catchmentKm: 150, kind: "regional" },
  { id: "wa-kalgoorlie", label: "Goldfields (Kalgoorlie–Boulder)", state: "WA", lat: -30.75, lng: 121.47, catchmentKm: 180, kind: "regional" },
  { id: "wa-pilbara", label: "Pilbara (Karratha–Pt Hedland)", state: "WA", lat: -20.74, lng: 116.85, catchmentKm: 250, kind: "regional" },
  { id: "wa-kimberley", label: "Kimberley (Broome)", state: "WA", lat: -17.96, lng: 122.24, catchmentKm: 300, kind: "regional" },

  // TAS
  { id: "tas-hobart", label: "Greater Hobart", state: "TAS", lat: -42.88, lng: 147.33, catchmentKm: 50, kind: "metro" },
  { id: "tas-launceston", label: "Launceston", state: "TAS", lat: -41.43, lng: 147.14, catchmentKm: 60, kind: "regional" },
  { id: "tas-devonport", label: "Devonport", state: "TAS", lat: -41.18, lng: 146.35, catchmentKm: 35, kind: "regional" },
  { id: "tas-burnie", label: "Burnie", state: "TAS", lat: -41.05, lng: 145.91, catchmentKm: 50, kind: "regional" },

  // NT
  { id: "nt-darwin", label: "Greater Darwin", state: "NT", lat: -12.46, lng: 130.84, catchmentKm: 70, kind: "metro" },
  { id: "nt-katherine", label: "Katherine", state: "NT", lat: -14.46, lng: 132.26, catchmentKm: 150, kind: "regional" },
  { id: "nt-alice-springs", label: "Alice Springs", state: "NT", lat: -23.7, lng: 133.88, catchmentKm: 300, kind: "regional" },

  // ACT — single region (the whole territory is one metro market)
  { id: "act", label: "Canberra (ACT)", state: "ACT", lat: -35.28, lng: 149.13, catchmentKm: 60, kind: "metro" },
];

const STATES_WITH_REST: StateCode[] = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT"];

export function restRegionId(state: StateCode): string {
  return `${state.toLowerCase()}-rest`;
}

/** Full registry: every anchor + a "Rest of <state>" bucket for each multi-region state. */
export const REGIONS: Region[] = [
  ...REGION_ANCHORS.map((a) => ({ id: a.id, label: a.label, state: a.state, kind: a.kind as RegionKind })),
  ...STATES_WITH_REST.map((s) => ({ id: restRegionId(s), label: `Rest of ${s}`, state: s, kind: "rest" as RegionKind })),
];

const REGION_BY_ID = new Map(REGIONS.map((r) => [r.id, r]));

export function regionById(id: string): Region | undefined {
  return REGION_BY_ID.get(id);
}
export function isValidRegion(id: string): boolean {
  return REGION_BY_ID.has(id);
}

/** Regions for a state, ordered metro → regional → rest, for the UI selector. */
export function regionsForState(state: StateCode): Region[] {
  const inState = REGIONS.filter((r) => r.state === state);
  const order: Record<RegionKind, number> = { metro: 0, regional: 1, rest: 2 };
  return inState.sort((a, b) => order[a.kind] - order[b.kind]);
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function validCoord(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
}

/**
 * Classify a station into a region id. Considers only anchors in the station's
 * own state (avoids cross-border mis-assignment like Albury/Wodonga); nearest
 * anchor within its catchment wins, else "Rest of <state>".
 */
export function regionOf(station: Station): string {
  const state = station.state;
  // ACT is a single region.
  if (state === "ACT") return "act";

  const anchors = REGION_ANCHORS.filter((a) => a.state === state);
  if (anchors.length === 0 || !validCoord(station.lat, station.lng)) {
    return restRegionId(state);
  }

  let best: RegionAnchor | null = null;
  let bestDist = Infinity;
  for (const a of anchors) {
    const d = haversineKm(station.lat, station.lng, a.lat, a.lng);
    if (d < bestDist) {
      bestDist = d;
      best = a;
    }
  }
  if (best && bestDist <= best.catchmentKm) return best.id;
  return restRegionId(state);
}

/**
 * Region nearest an arbitrary point (e.g. the map centre), for defaulting the
 * UI. Picks the nearest anchor across all states; within catchment → that
 * region, else that state's "Rest of <state>".
 */
export function nearestRegion(lat: number, lng: number): string | null {
  if (!validCoord(lat, lng)) return null;
  let best: RegionAnchor | null = null;
  let bestDist = Infinity;
  for (const a of REGION_ANCHORS) {
    const d = haversineKm(lat, lng, a.lat, a.lng);
    if (d < bestDist) {
      bestDist = d;
      best = a;
    }
  }
  if (!best) return null;
  if (best.state === "ACT") return "act";
  return bestDist <= best.catchmentKm ? best.id : restRegionId(best.state);
}
