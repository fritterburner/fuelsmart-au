import webpush from "web-push";
import type { PushSubscriptionJSON } from "./types";
import type { TriggeredAlert } from "./evaluate";
import { fuelLabel } from "./pricing";

/** Thrown when the push service tells us the subscription is gone (404/410) — self-cleaning signal. */
export class PushSubscriptionGoneError extends Error {
  constructor(message = "push subscription is gone") {
    super(message);
    this.name = "PushSubscriptionGoneError";
  }
}

let vapidConfigured = false;

function ensureVapidConfigured(): void {
  if (vapidConfigured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    throw new Error(
      "Push not configured: set NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT"
    );
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
}

function buildNotificationCopy(triggered: TriggeredAlert[]): { title: string; body: string } {
  if (triggered.length === 1) {
    const { alert, price } = triggered[0];
    const where =
      alert.scope === "station"
        ? "your saved station"
        : `${alert.state} (cheapest station)`;
    return {
      title: `${fuelLabel(alert.fuel)} price alert`,
      body: `${price.toFixed(1)}¢/L at ${where} — at or below your ${alert.targetCpl.toFixed(1)}¢ target.`,
    };
  }

  const summary = triggered
    .map((t) => `${fuelLabel(t.alert.fuel)} ${t.price.toFixed(1)}¢`)
    .join(", ");
  return {
    title: `${triggered.length} fuel price alerts triggered`,
    body: summary,
  };
}

/**
 * Sends one push notification summarising every alert that triggered for a
 * device this cron run (rather than one push per alert, to avoid spamming a
 * device that has several alerts trip in the same cycle).
 *
 * Throws PushSubscriptionGoneError on 404/410 so callers can self-clean;
 * any other error propagates as a normal Error (non-fatal to the caller).
 */
export async function sendAlertPush(
  subscription: PushSubscriptionJSON,
  triggered: TriggeredAlert[]
): Promise<void> {
  if (triggered.length === 0) return;
  ensureVapidConfigured();

  const { title, body } = buildNotificationCopy(triggered);
  const payload = JSON.stringify({
    title,
    body,
    url: "/alerts",
    tag: "fuelsmart-price-alert",
  });

  try {
    await webpush.sendNotification(
      subscription as unknown as webpush.PushSubscription,
      payload
    );
  } catch (err) {
    const statusCode = (err as { statusCode?: number } | undefined)?.statusCode;
    if (statusCode === 404 || statusCode === 410) {
      throw new PushSubscriptionGoneError();
    }
    throw err;
  }
}
