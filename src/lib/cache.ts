import { Redis } from "@upstash/redis";
import { Station } from "./types";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const STATION_KEY = "stations:all";
const META_KEY_PREFIX = "meta:lastUpdate";

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
