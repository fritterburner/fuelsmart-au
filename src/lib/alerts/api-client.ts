"use client";

import type { Alert, AlertInput, PushSubscriptionJSON } from "./types";

export interface AlertsState {
  subscribed: boolean;
  alerts: Alert[];
}

async function parseOrThrow(res: Response): Promise<AlertsState> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data?.error === "string" ? data.error : `request failed (${res.status})`);
  }
  return data as AlertsState;
}

export async function fetchAlerts(device: string): Promise<AlertsState> {
  const res = await fetch(`/api/alerts?device=${encodeURIComponent(device)}`);
  return parseOrThrow(res);
}

export async function registerSubscription(
  device: string,
  subscription: PushSubscriptionJSON
): Promise<AlertsState> {
  const res = await fetch("/api/alerts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ device, subscription }),
  });
  return parseOrThrow(res);
}

export async function addAlert(device: string, alert: AlertInput): Promise<AlertsState> {
  const res = await fetch("/api/alerts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ device, alert }),
  });
  return parseOrThrow(res);
}

export async function removeAlert(device: string, alertId: string): Promise<AlertsState> {
  const res = await fetch(
    `/api/alerts?device=${encodeURIComponent(device)}&alertId=${encodeURIComponent(alertId)}`,
    { method: "DELETE" }
  );
  return parseOrThrow(res);
}

/** Removes the push subscription and every alert for this device. */
export async function removeAllAlerts(device: string): Promise<AlertsState> {
  const res = await fetch(`/api/alerts?device=${encodeURIComponent(device)}`, { method: "DELETE" });
  return parseOrThrow(res);
}
