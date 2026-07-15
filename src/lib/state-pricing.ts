import { unstable_cache } from "next/cache";
import { Station, FuelCode, StateCode } from "./types";
import { FUEL_FALLBACKS, FUEL_TYPES } from "./fuel-codes";
import { getCachedStations, getStateLastUpdate } from "./cache";
import { getStateHistory } from "./history";
import { classifyDirection, DirectionResult } from "./cycle-direction";
import { ALL_STATES } from "./state-meta";

/**
 * Server-side aggregation backing /trends and /prices/[state]. Split in two
 * layers: `summariseStatePrices` is pure (no I/O) and unit-tested directly;
 * `getStateTrend` / `getNationalTrends` do the Redis reads and are wrapped in
 * `unstable_cache` with a 15-minute revalidate — matching the refresh cadence
 * — so the ?fuel= query param (which forces per-request dynamic rendering)
 * doesn't turn every page view into a fresh set of Redis calls.
 */

export interface PricedStation {
  station: Station;
  price: number;
  updated: string;
}

export interface StatePriceSummary {
  requestedFuel: FuelCode;
  activeFuel: FuelCode;
  fallbackNotice: string | null;
  stationCount: number;
  cheapest: PricedStation[];
  average: number | null;
  min: number | null;
  max: number | null;
}

export interface StateTrend extends StatePriceSummary {
  state: StateCode;
  lastUpdate: string | null;
  direction: DirectionResult | null;
}

function fuelName(code: FuelCode): string {
  return FUEL_TYPES.find((f) => f.code === code)?.name ?? code;
}

/**
 * Pure aggregation over an already-filtered set of stations (one state's
 * worth) for a chosen fuel: cheapest N stations, average, min/max — with the
 * same fuel-fallback behaviour as /api/stations (e.g. LAF standing in for U91
 * where no unleaded is reported).
 */
export function summariseStatePrices(
  stationsInState: Station[],
  fuel: FuelCode,
  limit: number = 10,
): StatePriceSummary {
  const matches = (f: FuelCode) => stationsInState.filter((s) => s.prices.some((p) => p.fuel === f));

  let activeFuel = fuel;
  let fallbackNotice: string | null = null;
  let pool = matches(fuel);

  if (pool.length === 0) {
    for (const fb of FUEL_FALLBACKS[fuel] ?? []) {
      const fbPool = matches(fb);
      if (fbPool.length > 0) {
        pool = fbPool;
        activeFuel = fb;
        fallbackNotice = `No ${fuelName(fuel)} reported here right now — showing ${fuelName(fb)} instead.`;
        break;
      }
    }
  }

  const priced: PricedStation[] = pool.map((station) => {
    const entries = station.prices.filter((p) => p.fuel === activeFuel);
    const best = entries.reduce((a, b) => (b.price < a.price ? b : a));
    return { station, price: best.price, updated: best.updated };
  });

  priced.sort((a, b) => a.price - b.price);
  const prices = priced.map((p) => p.price);
  const average = prices.length
    ? Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 10) / 10
    : null;

  return {
    requestedFuel: fuel,
    activeFuel,
    fallbackNotice,
    stationCount: pool.length,
    cheapest: priced.slice(0, limit),
    average,
    min: prices.length ? prices[0] : null,
    max: prices.length ? prices[prices.length - 1] : null,
  };
}

async function buildStateTrend(state: StateCode, fuel: FuelCode, allStations: Station[]): Promise<StateTrend> {
  const inState = allStations.filter((s) => s.state === state);
  const summary = summariseStatePrices(inState, fuel);
  const [lastUpdate, history] = await Promise.all([
    getStateLastUpdate(state),
    getStateHistory(state, summary.activeFuel, 30),
  ]);
  const direction = classifyDirection(history.map((h) => ({ date: h.date, value: h.avg })));
  return { ...summary, state, lastUpdate, direction };
}

/** One state's trend for one fuel — powers /prices/[state]. */
export const getStateTrend = unstable_cache(
  async (state: StateCode, fuel: FuelCode): Promise<StateTrend> => {
    const stations = (await getCachedStations()) ?? [];
    return buildStateTrend(state, fuel, stations);
  },
  ["fuelsmart-state-trend"],
  { revalidate: 900 },
);

/** All eight states/territories for one fuel — powers /trends. */
export const getNationalTrends = unstable_cache(
  async (fuel: FuelCode): Promise<StateTrend[]> => {
    const stations = (await getCachedStations()) ?? [];
    return Promise.all(ALL_STATES.map((state) => buildStateTrend(state, fuel, stations)));
  },
  ["fuelsmart-national-trends"],
  { revalidate: 900 },
);
