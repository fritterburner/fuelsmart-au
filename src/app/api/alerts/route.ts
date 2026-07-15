import { NextRequest, NextResponse } from "next/server";
import { deleteDeviceRecord, getDeviceRecord, saveDeviceRecord } from "@/lib/alerts/store";
import {
  MAX_ALERTS_PER_DEVICE,
  isValidDeviceId,
  isValidPushSubscription,
  requestBodyTooLarge,
  validateAlertInput,
} from "@/lib/alerts/validate";
import type { Alert, DeviceAlertRecord } from "@/lib/alerts/types";

/**
 * Account-free price alerts API.
 *
 * SECURITY / PRIVACY TRADE-OFF (documented per design brief): there is no
 * auth beyond possession of the device id. The id is an opaque random string
 * minted client-side (see src/lib/alerts/device-id.ts, which reuses the same
 * "fuelsmart-vid" identity as the usage-ping beacon) and never displayed or
 * transmitted anywhere except back to this API. It functions as a bearer
 * capability token: anyone who somehow learns another device's id could read
 * or modify that device's alerts. We accept this because:
 *   - there is nothing sensitive behind it (no PII, no payment info — at
 *     most a push endpoint and a handful of "notify me at station X" rules),
 *   - the id is 122 bits of crypto.randomUUID() entropy, never logged
 *     server-side, and not guessable or enumerable,
 *   - it matches the app's no-accounts design goal end-to-end.
 * If this ever needs to resist a stronger threat model (e.g. targeted
 * harassment via forced unsubscription), the fix is a per-device HMAC secret
 * returned once at registration — out of scope for this iteration.
 *
 * GET    /api/alerts?device=<id>              -> { subscribed, alerts }
 * POST   /api/alerts   { device, subscription?, alert?, alerts? }
 * DELETE /api/alerts?device=<id>&alertId=<id>  -> remove one alert
 * DELETE /api/alerts?device=<id>                -> remove subscription + all alerts
 */

function emptyRecord(): DeviceAlertRecord {
  return { subscription: null, alerts: [], updatedAt: new Date().toISOString() };
}

export async function GET(request: NextRequest) {
  const device = request.nextUrl.searchParams.get("device");
  if (!isValidDeviceId(device)) {
    return NextResponse.json({ error: "missing or invalid device id" }, { status: 400 });
  }

  const record = await getDeviceRecord(device);
  return NextResponse.json({
    subscribed: !!record?.subscription,
    alerts: record?.alerts ?? [],
  });
}

export async function POST(request: NextRequest) {
  const rawText = await request.text();
  if (requestBodyTooLarge(rawText)) {
    return NextResponse.json({ error: "request body too large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = rawText ? JSON.parse(rawText) : null;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  const { device, subscription, alert, alerts } = body as {
    device?: unknown;
    subscription?: unknown;
    alert?: unknown;
    alerts?: unknown;
  };

  if (!isValidDeviceId(device)) {
    return NextResponse.json({ error: "missing or invalid device id" }, { status: 400 });
  }
  if (subscription === undefined && alert === undefined && alerts === undefined) {
    return NextResponse.json(
      { error: "provide at least one of: subscription, alert, alerts" },
      { status: 400 }
    );
  }

  const existing = (await getDeviceRecord(device)) ?? emptyRecord();
  let record: DeviceAlertRecord = existing;

  // 1. Push subscription (register / update / explicitly clear with null).
  if (subscription !== undefined) {
    if (subscription === null) {
      record = { ...record, subscription: null };
    } else if (isValidPushSubscription(subscription)) {
      record = { ...record, subscription };
    } else {
      return NextResponse.json({ error: "invalid push subscription" }, { status: 400 });
    }
  }

  // 2. Add a single alert.
  if (alert !== undefined) {
    if (!record.subscription) {
      return NextResponse.json(
        { error: "a push subscription must be registered before adding alerts" },
        { status: 400 }
      );
    }
    if (record.alerts.length >= MAX_ALERTS_PER_DEVICE) {
      return NextResponse.json(
        { error: `at most ${MAX_ALERTS_PER_DEVICE} alerts per device` },
        { status: 400 }
      );
    }
    const validated = validateAlertInput(alert);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }
    const newAlert: Alert = {
      ...validated.value,
      id: cryptoRandomId(),
      createdAt: new Date().toISOString(),
    };
    record = { ...record, alerts: [...record.alerts, newAlert] };
  }

  // 3. Replace the whole alert list in one go (used by the /alerts management page).
  if (alerts !== undefined) {
    if (!Array.isArray(alerts)) {
      return NextResponse.json({ error: "alerts must be an array" }, { status: 400 });
    }
    if (alerts.length > MAX_ALERTS_PER_DEVICE) {
      return NextResponse.json(
        { error: `at most ${MAX_ALERTS_PER_DEVICE} alerts per device` },
        { status: 400 }
      );
    }
    if (alerts.length > 0 && !record.subscription) {
      return NextResponse.json(
        { error: "a push subscription must be registered before adding alerts" },
        { status: 400 }
      );
    }
    const nextAlerts: Alert[] = [];
    for (const raw of alerts) {
      // Preserve id/createdAt/lastTriggeredAt for alerts the client echoes back unchanged.
      const rawObj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
      const validated = validateAlertInput(rawObj);
      if (!validated.ok) {
        return NextResponse.json({ error: validated.error }, { status: 400 });
      }
      const existingMatch =
        typeof rawObj.id === "string" ? record.alerts.find((a) => a.id === rawObj.id) : undefined;
      nextAlerts.push({
        ...validated.value,
        id: existingMatch?.id ?? (typeof rawObj.id === "string" ? rawObj.id : cryptoRandomId()),
        createdAt: existingMatch?.createdAt ?? new Date().toISOString(),
        lastTriggeredAt: existingMatch?.lastTriggeredAt,
      });
    }
    record = { ...record, alerts: nextAlerts };
  }

  record = { ...record, updatedAt: new Date().toISOString() };
  await saveDeviceRecord(device, record);

  return NextResponse.json({ subscribed: !!record.subscription, alerts: record.alerts });
}

export async function DELETE(request: NextRequest) {
  const device = request.nextUrl.searchParams.get("device");
  const alertId = request.nextUrl.searchParams.get("alertId");

  if (!isValidDeviceId(device)) {
    return NextResponse.json({ error: "missing or invalid device id" }, { status: 400 });
  }

  if (!alertId) {
    // No alertId -> full unsubscribe: drop the subscription and every alert.
    await deleteDeviceRecord(device);
    return NextResponse.json({ subscribed: false, alerts: [] });
  }

  const existing = await getDeviceRecord(device);
  if (!existing) {
    return NextResponse.json({ subscribed: false, alerts: [] });
  }

  const nextAlerts = existing.alerts.filter((a) => a.id !== alertId);
  const record: DeviceAlertRecord = { ...existing, alerts: nextAlerts, updatedAt: new Date().toISOString() };
  await saveDeviceRecord(device, record);

  return NextResponse.json({ subscribed: !!record.subscription, alerts: record.alerts });
}

function cryptoRandomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
