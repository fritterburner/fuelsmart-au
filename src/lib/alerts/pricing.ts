import type { FuelCode, Station } from "@/lib/types";
import { FUEL_TYPES } from "@/lib/fuel-codes";
import type { Alert } from "./types";

export interface PriceLookup {
  price: number; // cents per litre
  updated: string; // ISO 8601
  /** Station the price came from — the alert's own station, or (for
   * state-scoped alerts) whichever station is currently cheapest. */
  stationId: string;
}

export interface PriceIndex {
  stationById: Map<string, Station>;
  /** Keyed `${state}|${fuel}` -> cheapest current price for that combination. */
  stateMin: Map<string, PriceLookup>;
}

/**
 * Builds lookup structures once per cron run from the freshly-refreshed
 * station cache, so evaluating N alerts costs O(N) map lookups rather than
 * O(N * stations.length) scans.
 */
export function buildPriceIndex(stations: Station[]): PriceIndex {
  const stationById = new Map<string, Station>();
  const stateMin = new Map<string, PriceLookup>();

  for (const station of stations) {
    stationById.set(station.id, station);
    for (const p of station.prices) {
      const key = `${station.state}|${p.fuel}`;
      const current = stateMin.get(key);
      if (!current || p.price < current.price) {
        stateMin.set(key, { price: p.price, updated: p.updated, stationId: station.id });
      }
    }
  }

  return { stationById, stateMin };
}

/**
 * Resolves the price an alert should be judged against right now.
 * Returns null when the price can't be determined (unknown station, station
 * no longer stocks the fuel, or no stations at all in a state for that fuel)
 * — callers must treat that as "skip this alert this run", not an error.
 */
export function currentPriceForAlert(index: PriceIndex, alert: Alert): PriceLookup | null {
  if (alert.scope === "station") {
    if (!alert.stationId) return null;
    const station = index.stationById.get(alert.stationId);
    if (!station) return null;
    const priceEntry = station.prices.find((p) => p.fuel === alert.fuel);
    if (!priceEntry) return null;
    return { price: priceEntry.price, updated: priceEntry.updated, stationId: station.id };
  }

  if (!alert.state) return null;
  return index.stateMin.get(`${alert.state}|${alert.fuel}`) ?? null;
}

const FUEL_SHORT_LABELS: Record<FuelCode, string> = Object.fromEntries(
  FUEL_TYPES.map((f) => [f.code, f.short])
) as Record<FuelCode, string>;

export function fuelLabel(fuel: FuelCode): string {
  return FUEL_SHORT_LABELS[fuel] ?? fuel;
}
