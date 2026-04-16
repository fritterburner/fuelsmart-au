import { Redis } from "@upstash/redis";
import { Station } from "./types";
import type { MarketData } from "./excise/types";
import { STALE_AGE_HOURS } from "./excise/baselines";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const STATION_KEY = "stations:all";
const META_KEY_PREFIX = "meta:lastUpdate";
const MARKET_DATA_KEY = "market-data:v1";

export async function cacheStations(stations: Station[]): Promise<void> {
  // Store as a single JSON blob — 2,740 stations ~= 2-3 MB, well within Redis limits
  await redis.set(STATION_KEY, JSON.stringify(stations));
  await redis.set(`${META_KEY_PREFIX}:global`, new Date().toISOString());
}

export async function getCachedStations(): Promise<Station[] | null> {
  const data = await redis.get<string>(STATION_KEY);
  if (!data) return null;
  return typeof data === "string" ? JSON.parse(data) : data;
}

export async function getLastUpdate(): Promise<string | null> {
  return redis.get<string>(`${META_KEY_PREFIX}:global`);
}

export async function setStateLastUpdate(state: string): Promise<void> {
  await redis.set(`${META_KEY_PREFIX}:${state}`, new Date().toISOString());
}

export async function getStateLastUpdate(state: string): Promise<string | null> {
  return redis.get<string>(`${META_KEY_PREFIX}:${state}`);
}

// --- Market data (Brent crude + AUD/USD for excise pass-through calculations) ---

type CachedMarketData = Omit<MarketData, "stale">;

export async function cacheMarketData(data: {
  brent_usd: number;
  aud_usd: number;
  as_of: string;
  source: string;
}): Promise<void> {
  const payload: CachedMarketData = {
    ...data,
    fetched_at: new Date().toISOString(),
  };
  await redis.set(MARKET_DATA_KEY, JSON.stringify(payload));
}

export async function getCachedMarketData(): Promise<MarketData | null> {
  const raw = await redis.get<string | CachedMarketData>(MARKET_DATA_KEY);
  if (!raw) return null;
  const data: CachedMarketData = typeof raw === "string" ? JSON.parse(raw) : raw;
  const ageMs = Date.now() - new Date(data.fetched_at).getTime();
  const stale = ageMs > STALE_AGE_HOURS * 60 * 60 * 1000;
  return { ...data, stale };
}
