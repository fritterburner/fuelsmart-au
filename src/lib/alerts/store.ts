import { Redis } from "@upstash/redis";
import type { DeviceAlertRecord } from "./types";

/**
 * Redis layout (mirrors the key-naming conventions in src/lib/cache.ts and
 * src/lib/usage.ts — one client per module, JSON blobs stored as strings):
 *
 *   alerts:device:<deviceId>  -> JSON.stringify(DeviceAlertRecord)
 *   alerts:index              -> SET of every deviceId that currently has a
 *                                 push subscription (so the cron job can walk
 *                                 all subscribers without a Redis KEYS scan).
 *
 * A device is added to the index only once it has a push subscription (no
 * point evaluating alerts nobody can be notified about), and removed as soon
 * as its subscription is deleted or found to be gone (410/404 on send).
 */

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const DEVICE_KEY_PREFIX = "alerts:device:";
const INDEX_KEY = "alerts:index";

function deviceKey(deviceId: string): string {
  return `${DEVICE_KEY_PREFIX}${deviceId}`;
}

function parseRecord(raw: string | DeviceAlertRecord | null): DeviceAlertRecord | null {
  if (!raw) return null;
  return typeof raw === "string" ? (JSON.parse(raw) as DeviceAlertRecord) : raw;
}

export async function getDeviceRecord(deviceId: string): Promise<DeviceAlertRecord | null> {
  const raw = await redis.get<string | DeviceAlertRecord>(deviceKey(deviceId));
  return parseRecord(raw ?? null);
}

/**
 * Persists a device's record. Keeps the `alerts:index` set in sync so the
 * cron job's fan-out stays cheap: indexed iff there's an active subscription.
 */
export async function saveDeviceRecord(deviceId: string, record: DeviceAlertRecord): Promise<void> {
  if (!record.subscription && record.alerts.length === 0) {
    // Nothing left worth keeping — fully clean up instead of writing an empty husk.
    await deleteDeviceRecord(deviceId);
    return;
  }
  await redis.set(deviceKey(deviceId), JSON.stringify(record));
  if (record.subscription) {
    await redis.sadd(INDEX_KEY, deviceId);
  } else {
    await redis.srem(INDEX_KEY, deviceId);
  }
}

export async function deleteDeviceRecord(deviceId: string): Promise<void> {
  await redis.del(deviceKey(deviceId));
  await redis.srem(INDEX_KEY, deviceId);
}

export async function listIndexedDeviceIds(): Promise<string[]> {
  const members = await redis.smembers(INDEX_KEY);
  return (members as string[]) ?? [];
}

/** Single round trip for all N subscribers, via MGET. */
export async function batchGetDeviceRecords(
  deviceIds: string[]
): Promise<Map<string, DeviceAlertRecord | null>> {
  const out = new Map<string, DeviceAlertRecord | null>();
  if (deviceIds.length === 0) return out;

  const keys = deviceIds.map(deviceKey);
  const raws = await redis.mget<(string | DeviceAlertRecord | null)[]>(...keys);
  deviceIds.forEach((id, i) => {
    out.set(id, parseRecord(raws?.[i] ?? null));
  });
  return out;
}

/** Single pipelined round trip to persist every re-armed record from this cron run. */
export async function batchSaveDeviceRecords(
  writes: { deviceId: string; record: DeviceAlertRecord }[]
): Promise<void> {
  if (writes.length === 0) return;
  const pipeline = redis.pipeline();
  for (const { deviceId, record } of writes) {
    pipeline.set(deviceKey(deviceId), JSON.stringify(record));
  }
  await pipeline.exec();
}

/** Single pipelined round trip to self-clean every device whose subscription is gone (410/404). */
export async function batchDeleteDeviceRecords(deviceIds: string[]): Promise<void> {
  if (deviceIds.length === 0) return;
  const pipeline = redis.pipeline();
  for (const deviceId of deviceIds) {
    pipeline.del(deviceKey(deviceId));
    pipeline.srem(INDEX_KEY, deviceId);
  }
  await pipeline.exec();
}
