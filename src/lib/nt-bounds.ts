/**
 * Rough bounding box for the Northern Territory. Intentionally permissive —
 * the purpose is "is the user looking at NT?" for a graceful outage notice,
 * not legal boundary enforcement. Corners overlap with northern SA, WA,
 * and QLD, which is acceptable for this UX use.
 */
export function isInNorthernTerritory(lat: number, lng: number): boolean {
  return lat >= -26 && lat <= -11 && lng >= 129 && lng <= 138;
}
