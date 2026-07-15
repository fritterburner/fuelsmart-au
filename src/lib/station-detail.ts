import { Station, FuelCode } from "./types";
import { haversineKm } from "./geo";

export interface NearbyAlternative {
  station: Station;
  price: number;
  distanceKm: number;
}

/**
 * Cheaper same-fuel stations within `radiusKm` of `target`. Pure — given an
 * already-fetched station list, no I/O — so it's unit-testable without Redis.
 * Kept same-state only: a haversine radius can technically cross a border,
 * but this is a "nearby on the map" convenience, not a routing feature.
 */
export function findNearbyCheaper(
  target: Station,
  allStations: Station[],
  fuel: FuelCode,
  radiusKm: number = 5,
  limit: number = 5,
): NearbyAlternative[] {
  const targetEntry = target.prices.find((p) => p.fuel === fuel);
  if (!targetEntry) return [];

  const out: NearbyAlternative[] = [];
  for (const s of allStations) {
    if (s.id === target.id || s.state !== target.state) continue;
    const entry = s.prices.find((p) => p.fuel === fuel);
    if (!entry || entry.price >= targetEntry.price) continue;
    const distanceKm = haversineKm(target.lat, target.lng, s.lat, s.lng);
    if (distanceKm > radiusKm) continue;
    out.push({ station: s, price: entry.price, distanceKm });
  }

  out.sort((a, b) => a.price - b.price || a.distanceKm - b.distanceKm);
  return out.slice(0, limit);
}
