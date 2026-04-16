import type { BaselineCity } from "./types";

/** Brent crude, USD/bbl, 31 March 2026 — baseline reference. */
export const BASELINE_OIL_USD = 112.57;

/** AUD/USD spot, 31 March 2026 — baseline reference. */
export const BASELINE_AUD_USD = 0.628;

/** Federal excise cut, cents per litre (52.6 → 26.3, effective 1 Apr – 30 Jun 2026). */
export const EXCISE_CUT_CPL = 26.3;

/** FX sensitivity coefficient — how much a 1% AUD change moves pump prices. */
export const FX_RATIO = 0.55;

/** Crude-cost share of pump price — higher for diesel. */
export const CRUDE_RATIO = {
  ULP: 0.45,
  DIESEL: 0.5,
} as const;

/** Confidence thresholds (km from nearest baseline city). */
export const CONFIDENCE_THRESHOLDS = {
  highMaxKm: 50,
  mediumMaxKm: 150,
} as const;

/** Pass-through verdict thresholds (% of excise cut reflected at the pump). */
export const VERDICT_THRESHOLDS = {
  fullMinPct: 90,
  partialMinPct: 60,
} as const;

/** Data freshness — max age before market data is flagged "stale". */
export const STALE_AGE_HOURS = 36;

/**
 * 27 reference cities with baseline pump prices as of 31 March 2026 (pre-excise-cut).
 * Coordinates are approximate city-centre positions — sufficient for nearest-of-27 lookups.
 */
export const BASELINE_CITIES: BaselineCity[] = [
  { name: "Sydney", state: "NSW", lat: -33.8688, lng: 151.2093, ulpBaseline: 240.0, dieselBaseline: 295.0 },
  { name: "Melbourne", state: "VIC", lat: -37.8136, lng: 144.9631, ulpBaseline: 238.0, dieselBaseline: 293.0 },
  { name: "Brisbane", state: "QLD", lat: -27.4705, lng: 153.026, ulpBaseline: 245.0, dieselBaseline: 298.0 },
  { name: "Perth", state: "WA", lat: -31.9523, lng: 115.8613, ulpBaseline: 242.0, dieselBaseline: 296.0 },
  { name: "Adelaide", state: "SA", lat: -34.9285, lng: 138.6007, ulpBaseline: 236.0, dieselBaseline: 291.0 },
  { name: "Hobart", state: "TAS", lat: -42.8821, lng: 147.3272, ulpBaseline: 248.0, dieselBaseline: 302.0 },
  { name: "Darwin", state: "NT", lat: -12.4634, lng: 130.8456, ulpBaseline: 260.0, dieselBaseline: 303.0 },
  { name: "Canberra", state: "ACT", lat: -35.2809, lng: 149.13, ulpBaseline: 241.0, dieselBaseline: 296.0 },
  { name: "Toowoomba", state: "QLD", lat: -27.5598, lng: 151.9507, ulpBaseline: 258.0, dieselBaseline: 305.0 },
  { name: "Gold Coast", state: "QLD", lat: -28.0167, lng: 153.4, ulpBaseline: 245.0, dieselBaseline: 298.0 },
  { name: "Sunshine Coast", state: "QLD", lat: -26.65, lng: 153.0667, ulpBaseline: 248.0, dieselBaseline: 300.0 },
  { name: "Cairns", state: "QLD", lat: -16.9203, lng: 145.7781, ulpBaseline: 255.0, dieselBaseline: 308.0 },
  { name: "Townsville", state: "QLD", lat: -19.2589, lng: 146.8169, ulpBaseline: 253.0, dieselBaseline: 306.0 },
  { name: "Mackay", state: "QLD", lat: -21.144, lng: 149.1861, ulpBaseline: 256.0, dieselBaseline: 309.0 },
  { name: "Rockhampton", state: "QLD", lat: -23.3781, lng: 150.5136, ulpBaseline: 254.0, dieselBaseline: 307.0 },
  { name: "Bundaberg", state: "QLD", lat: -24.8661, lng: 152.3489, ulpBaseline: 252.0, dieselBaseline: 305.0 },
  { name: "Hervey Bay", state: "QLD", lat: -25.2878, lng: 152.8228, ulpBaseline: 250.0, dieselBaseline: 304.0 },
  { name: "Gladstone", state: "QLD", lat: -23.8425, lng: 151.2583, ulpBaseline: 255.0, dieselBaseline: 308.0 },
  { name: "Newcastle", state: "NSW", lat: -32.9283, lng: 151.7817, ulpBaseline: 243.0, dieselBaseline: 297.0 },
  { name: "Wollongong", state: "NSW", lat: -34.4278, lng: 150.8931, ulpBaseline: 241.0, dieselBaseline: 295.0 },
  { name: "Central Coast", state: "NSW", lat: -33.4269, lng: 151.3425, ulpBaseline: 242.0, dieselBaseline: 296.0 },
  { name: "Geelong", state: "VIC", lat: -38.1499, lng: 144.3617, ulpBaseline: 240.0, dieselBaseline: 295.0 },
  { name: "Ballarat", state: "VIC", lat: -37.5622, lng: 143.8503, ulpBaseline: 242.0, dieselBaseline: 297.0 },
  { name: "Bendigo", state: "VIC", lat: -36.7582, lng: 144.2825, ulpBaseline: 243.0, dieselBaseline: 298.0 },
  { name: "Alice Springs", state: "NT", lat: -23.6975, lng: 133.8836, ulpBaseline: 265.0, dieselBaseline: 310.0 },
  { name: "Katherine", state: "NT", lat: -14.4669, lng: 132.2639, ulpBaseline: 270.0, dieselBaseline: 315.0 },
  // Note: "National Average" from the original plan is a useful display value for the
  // explainer page but not a geographic baseline — excluded from nearest-of-27 lookups.
];

/** National-average baseline (used only for display on the explainer page). */
export const NATIONAL_AVERAGE_BASELINE = {
  ulpBaseline: 245.0,
  dieselBaseline: 298.0,
} as const;
