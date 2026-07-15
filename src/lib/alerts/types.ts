import type { FuelCode, StateCode } from "@/lib/types";

/**
 * Account-free price alerts.
 *
 * Everything here is stored keyed by a *pseudonymous device id* (the same
 * random localStorage id minted by src/components/UsageBeacon.tsx under the
 * key "fuelsmart-vid" — see src/lib/alerts/device-id.ts). There are no
 * accounts, no logins, and no server-side identity beyond "whoever holds
 * this id". Possession of the device id is the only credential: it works
 * like a bearer/capability token. See src/app/api/alerts/route.ts for the
 * security trade-offs that follow from that.
 */

export type AlertScope = "station" | "state";

/** What the client sends when creating/editing an alert. */
export interface AlertInput {
  scope: AlertScope;
  /** Required when scope === "station". */
  stationId?: string;
  /** Required when scope === "state". */
  state?: StateCode;
  fuel: FuelCode;
  /** Target price in cents per litre (c/L). Alert fires at or below this. */
  targetCpl: number;
}

/** A stored alert — an AlertInput plus bookkeeping fields. */
export interface Alert extends AlertInput {
  id: string;
  createdAt: string; // ISO 8601
  /** ISO 8601 timestamp of the last time this alert fired. Drives the 24h re-arm window. */
  lastTriggeredAt?: string;
}

/** Shape of the browser PushSubscription, serialised via toJSON(). */
export interface PushSubscriptionJSON {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/** Everything stored in Redis for one device. */
export interface DeviceAlertRecord {
  subscription: PushSubscriptionJSON | null;
  alerts: Alert[];
  updatedAt: string; // ISO 8601
}
