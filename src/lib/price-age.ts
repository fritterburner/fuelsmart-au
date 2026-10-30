import { StateCode, StationPrice } from "./types";

/**
 * Maximum age (days) before a reported price is treated as stale and excluded
 * from the planner, fill-up finder and map. Tuned to each scheme's cadence:
 * NT and WA lock prices for a day; the 30-minute schemes should never be
 * more than a week old if the station is trading.
 */
export const MAX_PRICE_AGE_DAYS: Record<StateCode, number> = {
  NT: 3,
  WA: 3,
  VIC: 4,
  QLD: 7,
  NSW: 7,
  ACT: 7,
  TAS: 7,
  SA: 7,
};

/**
 * Parse a price timestamp. Feeds are inconsistent: QLD's TransactionDateUtc
 * carries no zone suffix but is UTC; NT/WA stamps are ISO with Z; NSW/TAS are
 * normalised to ISO with offset by the fetcher. Anything without an explicit
 * offset is treated as UTC rather than browser-local time.
 */
export function parsePriceTime(updated: string): number {
  if (!updated) return NaN;
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/i.test(updated);
  return Date.parse(hasZone ? updated : `${updated}Z`);
}

export function priceAgeDays(price: StationPrice, now: number = Date.now()): number {
  const t = parsePriceTime(price.updated);
  if (Number.isNaN(t)) return Infinity;
  return (now - t) / 86_400_000;
}

export function isPriceCurrent(
  price: StationPrice,
  state: StateCode,
  now: number = Date.now(),
): boolean {
  return priceAgeDays(price, now) <= (MAX_PRICE_AGE_DAYS[state] ?? 7);
}
