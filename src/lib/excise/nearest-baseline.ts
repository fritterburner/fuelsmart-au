import { BASELINE_CITIES, CONFIDENCE_THRESHOLDS } from "./baselines";
import type { BaselineCity, Confidence, NearestBaselineResult } from "./types";

/** Haversine great-circle distance in km between two lat/lng points. */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371; // mean earth radius, km
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function classifyConfidence(distanceKm: number): Confidence {
  if (distanceKm <= CONFIDENCE_THRESHOLDS.highMaxKm) return "high";
  if (distanceKm <= CONFIDENCE_THRESHOLDS.mediumMaxKm) return "medium";
  return "low";
}

/**
 * Find the nearest baseline city to a given lat/lng. Returns both the city and
 * a confidence indicator based on distance (<50km=high, 50–150=medium, >150=low).
 */
export function nearestBaseline(lat: number, lng: number): NearestBaselineResult {
  let best: BaselineCity = BASELINE_CITIES[0];
  let bestKm = Infinity;

  for (const city of BASELINE_CITIES) {
    const d = haversineKm(lat, lng, city.lat, city.lng);
    if (d < bestKm) {
      bestKm = d;
      best = city;
    }
  }

  return {
    city: best,
    distanceKm: bestKm,
    confidence: classifyConfidence(bestKm),
  };
}
