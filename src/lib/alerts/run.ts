import { getCachedStations } from "@/lib/cache";
import { buildPriceIndex } from "./pricing";
import { decideForDevice } from "./evaluate";
import {
  batchDeleteDeviceRecords,
  batchGetDeviceRecords,
  batchSaveDeviceRecords,
  listIndexedDeviceIds,
} from "./store";
import { PushSubscriptionGoneError, sendAlertPush } from "./push";
import type { DeviceAlertRecord } from "./types";

export interface AlertEvaluationSummary {
  devicesChecked: number;
  alertsChecked: number;
  triggered: number;
  pushesSent: number;
  devicesCleaned: number;
  errors: string[];
}

const EMPTY_SUMMARY: AlertEvaluationSummary = {
  devicesChecked: 0,
  alertsChecked: 0,
  triggered: 0,
  pushesSent: 0,
  devicesCleaned: 0,
  errors: [],
};

/**
 * Runs right after a successful cron refresh (see src/app/api/cron/refresh/route.ts).
 * Reads the station cache that refresh just wrote, evaluates every subscribed
 * device's alerts against it, sends at most one push per device, and
 * self-cleans subscriptions the push service reports as gone.
 *
 * Redis cost for N indexed subscribers, regardless of N's size:
 *   1x GET  (station cache blob — already fresh from the refresh that just ran)
 *   1x SMEMBERS (alerts:index)
 *   1x MGET (all N device records, one round trip)
 *   1x pipelined write for re-armed records (only devices that fired)
 *   1x pipelined write for cleaned-up gone subscriptions (only devices that 410/404'd)
 * i.e. O(1) Redis round trips, independent of subscriber count — the payload
 * size of the MGET scales with N, but that's bandwidth, not round trips.
 * Never throws — callers should still wrap this in try/catch since network
 * errors from the push service are logged into `errors` but I/O setup issues
 * (e.g. missing VAPID env vars) surface as thrown errors on the first send.
 */
export async function evaluateAndNotify(): Promise<AlertEvaluationSummary> {
  const errors: string[] = [];

  const stations = await getCachedStations();
  if (!stations || stations.length === 0) {
    return { ...EMPTY_SUMMARY, errors: ["no cached stations to evaluate against"] };
  }

  const deviceIds = await listIndexedDeviceIds();
  if (deviceIds.length === 0) {
    return { ...EMPTY_SUMMARY };
  }

  const index = buildPriceIndex(stations);
  const records = await batchGetDeviceRecords(deviceIds);

  let alertsChecked = 0;
  let triggeredCount = 0;
  let pushesSent = 0;
  const cleanupIds: string[] = [];
  const writes: { deviceId: string; record: DeviceAlertRecord }[] = [];
  const now = new Date();

  for (const deviceId of deviceIds) {
    const record = records.get(deviceId);
    if (!record || !record.subscription) {
      // Indexed but no usable record any more (e.g. manually deleted key) — self-heal the index.
      cleanupIds.push(deviceId);
      continue;
    }

    alertsChecked += record.alerts.length;
    const decision = decideForDevice(deviceId, record, index, now);
    triggeredCount += decision.triggered.length;

    if (decision.triggered.length === 0) continue;

    try {
      await sendAlertPush(record.subscription, decision.triggered);
      pushesSent++;
      writes.push({
        deviceId,
        record: { ...record, alerts: decision.updatedAlerts, updatedAt: now.toISOString() },
      });
    } catch (err) {
      if (err instanceof PushSubscriptionGoneError) {
        cleanupIds.push(deviceId);
      } else {
        errors.push(`push to device ${deviceId.slice(0, 8)}…: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  await Promise.all([batchSaveDeviceRecords(writes), batchDeleteDeviceRecords(cleanupIds)]);

  return {
    devicesChecked: deviceIds.length,
    alertsChecked,
    triggered: triggeredCount,
    pushesSent,
    devicesCleaned: cleanupIds.length,
    errors,
  };
}
