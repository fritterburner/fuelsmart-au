import { Redis } from "@upstash/redis";
import { Station, FuelCode, StateCode } from "./types";

/**
 * 30-day price history. A compact daily snapshot is written by the nightly cron;
 * per-station keys expire after ~35 days; per-state aggregates persist ~13 months (for the forecast). Footprint stays bounded.
 * This is aggregate price data only — nothing about users — so it sits fine with
 * the privacy-first model. It's also the shared input for the planned forecast.
 */

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const STATION_TTL_SECONDS = 35 * 24 * 60 * 60;
const STATE_TTL_SECONDS = 400 * 24 * 60 * 60; // ~13 months — backfill + forecast need a long state window

function dayKey(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

function lastNDays(n: number, from: Date = new Date()): string[] {
  const days: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(from);
    d.setUTCDate(d.getUTCDate() - i);
    days.push(dayKey(d));
  }
  return days;
}

function parseBlob<T>(blob: unknown): T | null {
  if (blob == null) return null;
  if (typeof blob === "string") {
    try {
      return JSON.parse(blob) as T;
    } catch {
      return null;
    }
  }
  return blob as T;
}

type StationDay = Record<string, Partial<Record<FuelCode, number>>>;
interface StateAgg {
  avg: number;
  min: number;
  count: number;
}
type StateDay = Partial<Record<StateCode, Partial<Record<FuelCode, StateAgg>>>>;

/**
 * Record one day's snapshot: per-station price per fuel, plus per-state
 * average/min/count aggregates. Safe to call repeatedly for the same day (it
 * overwrites that day's keys).
 */
export async function recordDailySnapshot(
  stations: Station[],
  date: Date = new Date()
): Promise<void> {
  const day = dayKey(date);
  const stationMap: StationDay = {};
  const acc: Record<string, Record<string, { sum: number; min: number; count: number }>> = {};

  for (const s of stations) {
    const perFuel: Partial<Record<FuelCode, number>> = {};
    for (const p of s.prices) {
      const existing = perFuel[p.fuel];
      if (existing === undefined || p.price < existing) perFuel[p.fuel] = p.price;
    }
    if (Object.keys(perFuel).length === 0) continue;
    stationMap[s.id] = perFuel;

    const stateAcc = (acc[s.state] ??= {});
    for (const [fuel, price] of Object.entries(perFuel) as [FuelCode, number][]) {
      const a = (stateAcc[fuel] ??= { sum: 0, min: Infinity, count: 0 });
      a.sum += price;
      a.count += 1;
      if (price < a.min) a.min = price;
    }
  }

  const stateDay: StateDay = {};
  for (const [state, fuels] of Object.entries(acc)) {
    const fm: Partial<Record<FuelCode, StateAgg>> = {};
    for (const [fuel, a] of Object.entries(fuels) as [FuelCode, { sum: number; min: number; count: number }][]) {
      fm[fuel] = { avg: Math.round((a.sum / a.count) * 10) / 10, min: a.min, count: a.count };
    }
    stateDay[state as StateCode] = fm;
  }

  await Promise.all([
    redis.set(`history:stations:${day}`, JSON.stringify(stationMap), { ex: STATION_TTL_SECONDS }),
    redis.set(`history:state:${day}`, JSON.stringify(stateDay), { ex: STATE_TTL_SECONDS }),
  ]);
}

export interface StatePricePoint {
  date: string;
  avg: number | null;
  min: number | null;
}

export async function getStateHistory(
  state: StateCode,
  fuel: FuelCode,
  days: number = 30
): Promise<StatePricePoint[]> {
  const dates = lastNDays(days);
  const blobs = await Promise.all(dates.map((d) => redis.get(`history:state:${d}`)));
  return dates.map((date, i) => {
    const parsed = parseBlob<StateDay>(blobs[i]);
    const agg = parsed?.[state]?.[fuel];
    return { date, avg: agg?.avg ?? null, min: agg?.min ?? null };
  });
}

export interface StationPricePoint {
  date: string;
  price: number | null;
}

export async function getStationHistory(
  stationId: string,
  fuel: FuelCode,
  days: number = 30
): Promise<StationPricePoint[]> {
  const dates = lastNDays(days);
  const blobs = await Promise.all(dates.map((d) => redis.get(`history:stations:${d}`)));
  return dates.map((date, i) => {
    const parsed = parseBlob<StationDay>(blobs[i]);
    const price = parsed?.[stationId]?.[fuel] ?? null;
    return { date, price };
  });
}

/**
 * Merge ONE state's daily aggregate into history:state:<date>, preserving any
 * other states already stored for that day. The live cron writes all states at
 * once (and can overwrite); the one-off backfill writes state-by-state, so it
 * needs this read-merge-write. Long TTL so backfilled months persist.
 */
export async function mergeStateDay(
  date: string,
  state: StateCode,
  perFuel: Partial<Record<FuelCode, { avg: number; min: number; count: number }>>,
): Promise<void> {
  const key = `history:state:${date}`;
  const existing =
    parseBlob<Record<string, Partial<Record<FuelCode, { avg: number; min: number; count: number }>>>>(
      await redis.get(key),
    ) ?? {};
  existing[state] = perFuel;
  await redis.set(key, JSON.stringify(existing), { ex: STATE_TTL_SECONDS });
}
