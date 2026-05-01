/**
 * Price-range sanity check applied by every fetcher before a StationPrice is
 * written.
 *
 * Feeds emit two kinds of bad rows:
 *
 * 1. Sentinel values like 999.9 c/L meaning "no data" — caught by the global
 *    upper bound.
 * 2. Single rows where a station has a wildly understated price (decimal
 *    misplacement, units confusion, or stale promo). These have shown up as
 *    e.g. 31.7 c/L diesel at a marina that PetrolSpy reports at 348.7 c/L —
 *    a 10× ratio characteristic of a tenths-of-a-cent vs. cents misread.
 *
 * The global floor is deliberately permissive (LPG can genuinely be ~30 c/L
 * in some markets), but each fuel has its own tighter floor so a 31.7 c/L
 * row tagged as "DL" gets rejected even though the same value as "LPG" would
 * be borderline plausible.
 *
 * Bounds reflect 2020s Australian pump prices with comfortable headroom for
 * future shock. Tighten only if you see legitimate prices being rejected in
 * the cron logs.
 */

import type { FuelCode } from "./types";

export const PRICE_MIN_CPL = 20;
export const PRICE_MAX_CPL = 500;

/**
 * Per-fuel minimum cents-per-litre. Anything below this for the named fuel is
 * treated as bad data and dropped. Falls back to PRICE_MIN_CPL when the fuel
 * isn't recognised (which itself shouldn't happen — fetchers map IDs to known
 * fuel codes before calling this).
 *
 * Diesel and petrol haven't been sub-100 c/L in Australia for two decades, so
 * 80 is a wide safety net rather than a tight bound — catches obvious 10×
 * decimal slips without false-rejecting any plausible real-world price.
 */
const FUEL_MIN_CPL: Record<FuelCode, number> = {
  U91: 80,
  DL: 80,
  E10: 80,
  P95: 80,
  P98: 80,
  PD: 80,
  E85: 60, // promo pricing has gone as low as ~80 c/L historically
  LPG: 30, // LPG is genuinely cheap; rural QLD has hit ~50 c/L
  LAF: 80, // long-life additive fuel — treat as petrol-equivalent
};

export function isRealisticPrice(cpl: number, fuel?: FuelCode): boolean {
  if (!Number.isFinite(cpl)) return false;
  const min = fuel ? FUEL_MIN_CPL[fuel] : PRICE_MIN_CPL;
  return cpl >= min && cpl <= PRICE_MAX_CPL;
}
