/**
 * Price-range sanity check applied by every fetcher before a StationPrice is
 * written.
 *
 * Feeds occasionally emit sentinel values like 999.9 c/L to mean "no data" or
 * "station closed" rather than hiding the row entirely. Those leak into the
 * map as absurd red pins and break discount calculations. This helper gives
 * us one place to reject them cleanly.
 *
 * Bounds are deliberately wide — real AU pump prices have ranged 120–260
 * c/L in the 2020s, so 20 c/L to 500 c/L comfortably covers any plausible
 * future shock while catching the obvious sentinels.
 */

export const PRICE_MIN_CPL = 20;
export const PRICE_MAX_CPL = 500;

export function isRealisticPrice(cpl: number): boolean {
  if (!Number.isFinite(cpl)) return false;
  return cpl >= PRICE_MIN_CPL && cpl <= PRICE_MAX_CPL;
}
