import type { Station } from "@/lib/types";
import type { Alert, DeviceAlertRecord } from "./types";
import { isStructurallyValidStoredAlert } from "./validate";
import { buildPriceIndex, currentPriceForAlert, type PriceIndex } from "./pricing";

/** Once an alert fires, it won't fire again for this long even if the price stays below target. */
export const REARM_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface TriggeredAlert {
  alert: Alert;
  price: number; // cents per litre, at time of trigger
  updated: string; // ISO 8601 — freshness of that price
}

export interface DeviceDecision {
  deviceId: string;
  /** Alerts that should fire (send a push) this run. */
  triggered: TriggeredAlert[];
  /** The full alert list, with lastTriggeredAt bumped for anything in `triggered`.
   *  Always the same length as record.alerts (malformed entries are dropped). */
  updatedAlerts: Alert[];
}

/**
 * Pure decision function — no I/O. Given one device's stored record and the
 * current price index, decides which alerts (if any) should fire right now.
 *
 * Rules:
 *  - malformed/unparsable alerts are silently dropped (never crash the cron).
 *  - an alert with no resolvable current price (unknown station, station no
 *    longer stocks that fuel, no stations for that state+fuel) is left as-is
 *    and skipped this run.
 *  - an alert fires when price <= targetCpl AND it is not within its 24h
 *    re-arm window (i.e. it hasn't already fired in the last 24h).
 */
export function decideForDevice(
  deviceId: string,
  record: DeviceAlertRecord,
  index: PriceIndex,
  now: Date
): DeviceDecision {
  const triggered: TriggeredAlert[] = [];
  const updatedAlerts: Alert[] = [];

  for (const raw of record.alerts) {
    if (!isStructurallyValidStoredAlert(raw)) continue; // drop malformed entries entirely

    const current = currentPriceForAlert(index, raw);
    if (!current) {
      // Can't resolve a price this run (e.g. station vanished from the feed) — keep the alert, skip it.
      updatedAlerts.push(raw);
      continue;
    }

    const withinRearmWindow =
      !!raw.lastTriggeredAt &&
      now.getTime() - new Date(raw.lastTriggeredAt).getTime() < REARM_WINDOW_MS;

    if (current.price <= raw.targetCpl && !withinRearmWindow) {
      const bumped: Alert = { ...raw, lastTriggeredAt: now.toISOString() };
      updatedAlerts.push(bumped);
      triggered.push({ alert: raw, price: current.price, updated: current.updated });
    } else {
      updatedAlerts.push(raw);
    }
  }

  return { deviceId, triggered, updatedAlerts };
}

/** Convenience wrapper for callers that already have a Station[] and want to build the index once. */
export function buildIndexAndDecide(
  stations: Station[],
  deviceId: string,
  record: DeviceAlertRecord,
  now: Date = new Date()
): DeviceDecision {
  return decideForDevice(deviceId, record, buildPriceIndex(stations), now);
}
