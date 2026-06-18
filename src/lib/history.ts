import { Redis } from "@upstash/redis";
import { Station, FuelCode, StateCode } from "./types";
import { regionOf, restRegionId, regionById, MIN_REGION_STATIONS } from "./regions";

/**
 * Price history. A compact daily snapshot is written by the nightly cron:
 *  - per-station prices (35-day TTL — powers the per-station popup),
 *  - per-STATE aggregates and per-REGION aggregates (~13-month TTL — power the
 *    history charts + forecast).
 * Aggregate price data only — nothing about users. Footprint stays bounded.
 */

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const STATION_TTL_SECONDS = 35 * 24 * 60 * 60;
const STATE_TTL_SECONDS = 400 * 24 * 60 * 60; // ~13 months — long state/region window

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

interface RawAgg {
  sum: number;
  min: number;
  count: number;
}
type StationDay = Record<string, Partial<Record<FuelCode, number>>>;
interface StateAgg {
  avg: number;
  min: number;
  count: number;
}
type StateDay = Partial<Record<StateCode, Partial<Record<FuelCode, StateAgg>>>>;
type RegionDay = Record<string, Partial<Record<FuelCode, StateAgg>>>;

function foldPrice(bucket: Record<string, RawAgg>, fuel: string, price: number): void {
  const a = (bucket[fuel] ??= { sum: 0, min: Infinity, count: 0 });
  a.sum += price;
  a.count += 1;
  if (price < a.min) a.min = price;
}

function finaliseAgg(bucket: Record<string, RawAgg>): Partial<Record<FuelCode, StateAgg>> {
  const out: Partial<Record<FuelCode, StateAgg>> = {};
  for (const [fuel, a] of Object.entries(bucket)) {
    out[fuel as FuelCode] = { avg: Math.round((a.sum / a.count) * 10) / 10, min: a.min, count: a.count };
  }
  return out;
}

/**
 * Record one day's snapshot: per-station prices, per-state aggregates, and
 * per-region aggregates (with thin-region rollup into "Rest of <state>").
 * Safe to call repeatedly for the same day (it overwrites that day's keys).
 */
export async function recordDailySnapshot(stations: Station[], date: Date = new Date()): Promise<void> {
  const day = dayKey(date);
  const stationMap: StationDay = {};
  const stateAcc: Record<string, Record<string, RawAgg>> = {};
  const regionAcc: Record<string, { stations: number; fuels: Record<string, RawAgg> }> = {};

  for (const s of stations) {
    const perFuel: Partial<Record<FuelCode, number>> = {};
    for (const p of s.prices) {
      const existing = perFuel[p.fuel];
      if (existing === undefined || p.price < existing) perFuel[p.fuel] = p.price;
    }
    const fuelsHere = Object.entries(perFuel) as [FuelCode, number][];
    if (fuelsHere.length === 0) continue;
    stationMap[s.id] = perFuel;

    const sBucket = (stateAcc[s.state] ??= {});
    const rid = regionOf(s);
    const rBucket = (regionAcc[rid] ??= { stations: 0, fuels: {} });
    rBucket.stations += 1;
    for (const [fuel, price] of fuelsHere) {
      foldPrice(sBucket, fuel, price);
      foldPrice(rBucket.fuels, fuel, price);
    }
  }

  // Roll thin non-rest regions into their state's "Rest of <state>" bucket.
  for (const rid of Object.keys(regionAcc)) {
    const reg = regionById(rid);
    if (!reg || reg.kind === "rest" || rid === "act") continue;
    const entry = regionAcc[rid];
    if (entry.stations >= MIN_REGION_STATIONS) continue;
    const restId = restRegionId(reg.state);
    const rest = (regionAcc[restId] ??= { stations: 0, fuels: {} });
    rest.stations += entry.stations;
    for (const [fuel, a] of Object.entries(entry.fuels)) {
      const ra = (rest.fuels[fuel] ??= { sum: 0, min: Infinity, count: 0 });
      ra.sum += a.sum;
      ra.count += a.count;
      if (a.min < ra.min) ra.min = a.min;
    }
    delete regionAcc[rid];
  }

  const stateDay: StateDay = {};
  for (const [state, fuels] of Object.entries(stateAcc)) {
    stateDay[state as StateCode] = finaliseAgg(fuels);
  }

  const regionDay: RegionDay = {};
  for (const [rid, entry] of Object.entries(regionAcc)) {
    regionDay[rid] = finaliseAgg(entry.fuels);
  }

  await Promise.all([
    redis.set(`history:stations:${day}`, JSON.stringify(stationMap), { ex: STATION_TTL_SECONDS }),
    redis.set(`history:state:${day}`, JSON.stringify(stateDay), { ex: STATE_TTL_SECONDS }),
    redis.set(`history:region:${day}`, JSON.stringify(regionDay), { ex: STATE_TTL_SECONDS }),
  ]);
}

export interface StatePricePoint {
  date: string;
  avg: number | null;
  min: number | null;
}

export async function getStateHistory(state: StateCode, fuel: FuelCode, days: number = 30): Promise<StatePricePoint[]> {
  const dates = lastNDays(days);
  const blobs = await Promise.all(dates.map((d) => redis.get(`history:state:${d}`)));
  return dates.map((date, i) => {
    const parsed = parseBlob<StateDay>(blobs[i]);
    const agg = parsed?.[state]?.[fuel];
    return { date, avg: agg?.avg ?? null, min: agg?.min ?? null };
  });
}

export async function getRegionHistory(regionId: string, fuel: FuelCode, days: number = 30): Promise<StatePricePoint[]> {
  const dates = lastNDays(days);
  const blobs = await Promise.all(dates.map((d) => redis.get(`history:region:${d}`)));
  return dates.map((date, i) => {
    const parsed = parseBlob<RegionDay>(blobs[i]);
    const agg = parsed?.[regionId]?.[fuel];
    return { date, avg: agg?.avg ?? null, min: agg?.min ?? null };
  });
}

export interface StationPricePoint {
  date: string;
  price: number | null;
}

export async function getStationHistory(stationId: string, fuel: FuelCode, days: number = 30): Promise<StationPricePoint[]> {
  const dates = lastNDays(days);
  const blobs = await Promise.all(dates.map((d) => redis.get(`history:stations:${d}`)));
  return dates.map((date, i) => {
    const parsed = parseBlob<StationDay>(blobs[i]);
    const price = parsed?.[stationId]?.[fuel] ?? null;
    return { date, price };
  });
}

/**
 * Pure: average (and min) one day's stored per-station prices across a set of
 * station ids, for one fuel. Exported so the aggregation is unit-testable
 * without Redis.
 */
export function aggregateAreaDay(
  parsed: StationDay | null,
  ids: string[],
  fuel: FuelCode,
): { avg: number | null; min: number | null } {
  if (!parsed) return { avg: null, min: null };
  let sum = 0;
  let count = 0;
  let min = Infinity;
  for (const id of ids) {
    const price = parsed[id]?.[fuel];
    if (typeof price === "number" && Number.isFinite(price)) {
      sum += price;
      count += 1;
      if (price < min) min = price;
    }
  }
  if (count === 0) return { avg: null, min: null };
  return { avg: Math.round((sum / count) * 10) / 10, min };
}

/**
 * 30-day averaged price history for an arbitrary set of stations — the "tap an
 * area" circle. Reads the SAME daily per-station snapshots the per-station
 * sparkline already reads, so it adds no extra Redis cost beyond one station's
 * history (the day blobs are fetched once and averaged across the ids).
 */
export async function getAreaHistory(
  stationIds: string[],
  fuel: FuelCode,
  days: number = 30,
): Promise<StatePricePoint[]> {
  if (stationIds.length === 0) return [];
  const dates = lastNDays(days);
  const blobs = await Promise.all(dates.map((d) => redis.get(`history:stations:${d}`)));
  return dates.map((date, i) => {
    const parsed = parseBlob<StationDay>(blobs[i]);
    const { avg, min } = aggregateAreaDay(parsed, stationIds, fuel);
    return { date, avg, min };
  });
}

/**
 * Merge ONE state's daily aggregate into history:state:<date>, preserving other
 * states already stored for that day (used by the one-off backfill).
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
