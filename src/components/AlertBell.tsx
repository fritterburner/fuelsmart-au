"use client";

import { useEffect, useState } from "react";
import type { FuelCode } from "@/lib/types";
import { getOrCreateDeviceId } from "@/lib/alerts/device-id";
import { sanitiseDraft } from "@/lib/number-input";
import {
  getExistingSubscription,
  needsIOSInstallGuidance,
  pushSupported,
  subscribeToPush,
} from "@/lib/alerts/push-client";
import { addAlert, fetchAlerts, registerSubscription, removeAlert } from "@/lib/alerts/api-client";
import type { Alert } from "@/lib/alerts/types";

interface Props {
  stationId: string;
  stationName?: string;
  fuel: FuelCode;
  /** Prefills the target input with the current pump price so "alert me if it drops" is a one-tap edit. */
  currentPriceCpl?: number;
}

type Status = "checking" | "unsupported" | "needs-ios-install" | "ready";

/**
 * Self-contained "alert me" affordance for a single station+fuel. Drop this
 * into the station popup (see MapView.tsx's popup content) — it manages its
 * own device id, push subscription, and alert CRUD; the only inputs it needs
 * are which station/fuel it's attached to.
 */
export default function AlertBell({ stationId, stationName, fuel, currentPriceCpl }: Props) {
  const [status, setStatus] = useState<Status>("checking");
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [existingAlert, setExistingAlert] = useState<Alert | null>(null);
  const [target, setTarget] = useState<string>(
    currentPriceCpl ? currentPriceCpl.toFixed(1) : ""
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = getOrCreateDeviceId();
    setDeviceId(id);
    if (!id || !pushSupported()) {
      setStatus(needsIOSInstallGuidance() ? "needs-ios-install" : "unsupported");
      return;
    }
    setStatus("ready");
    fetchAlerts(id)
      .then((state) => {
        const match = state.alerts.find(
          (a) => a.scope === "station" && a.stationId === stationId && a.fuel === fuel
        );
        setExistingAlert(match ?? null);
      })
      .catch(() => {
        /* best-effort — the bell just starts in "no alert yet" state */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationId, fuel]);

  async function handleEnable() {
    if (!deviceId) return;
    setError(null);
    const targetCpl = Number(target);
    if (!Number.isFinite(targetCpl) || targetCpl < 50 || targetCpl > 400) {
      setError("Enter a target between 50 and 400 c/L");
      return;
    }

    setBusy(true);
    try {
      let subscription = await getExistingSubscription();
      if (!subscription) {
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidKey) {
          setError("Push notifications aren't configured yet");
          return;
        }
        subscription = await subscribeToPush(vapidKey);
        if (!subscription) {
          setError("Notification permission wasn't granted");
          return;
        }
        await registerSubscription(deviceId, subscription);
      }

      const result = await addAlert(deviceId, { scope: "station", stationId, fuel, targetCpl });
      const match = result.alerts.find(
        (a) => a.scope === "station" && a.stationId === stationId && a.fuel === fuel
      );
      setExistingAlert(match ?? null);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    if (!deviceId || !existingAlert) return;
    setBusy(true);
    try {
      await removeAlert(deviceId, existingAlert.id);
      setExistingAlert(null);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (status === "checking") return null;

  if (status === "unsupported") return null; // No web push on this platform — stay out of the way.

  if (status === "needs-ios-install") {
    return (
      <div className="text-xs text-gray-500 mt-2">
        Add FuelSmart to your Home Screen (Share → Add to Home Screen) to enable price alerts on
        iPhone/iPad.
      </div>
    );
  }

  return (
    <div className="mt-2">
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`flex items-center gap-1.5 text-xs font-medium rounded-full px-3 py-1.5 min-h-[32px] border transition-colors ${
            existingAlert
              ? "bg-emerald-50 border-emerald-300 text-emerald-700"
              : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
          }`}
        >
          <BellIcon filled={!!existingAlert} />
          {existingAlert
            ? `Alert set at ${existingAlert.targetCpl.toFixed(1)}¢`
            : `Alert me — ${stationName ?? "this station"}`}
        </button>
      )}

      {open && (
        <div className="border border-gray-200 rounded-lg p-2.5 bg-gray-50 text-xs space-y-2 min-w-[220px]">
          {existingAlert ? (
            <>
              <div className="text-gray-700">
                You&apos;ll get a notification when {fuel} here drops to{" "}
                <strong>{existingAlert.targetCpl.toFixed(1)}¢/L</strong> or below.
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={busy}
                  className="flex-1 py-1.5 rounded bg-red-50 text-red-700 border border-red-200 font-medium disabled:opacity-60"
                >
                  {busy ? "Removing…" : "Remove alert"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="py-1.5 px-3 rounded border border-gray-300"
                >
                  Close
                </button>
              </div>
            </>
          ) : (
            <>
              <label className="block text-gray-700">
                Notify me when {fuel} drops to or below:
                <div className="flex items-center gap-1 mt-1">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={target}
                    onChange={(e) => setTarget(sanitiseDraft(e.target.value, { decimals: 1 }))}
                    className="w-20 px-2 py-1.5 min-h-[32px] border rounded text-sm"
                  />
                  <span>¢/L</span>
                </div>
              </label>
              {error && <div className="text-red-600">{error}</div>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleEnable}
                  disabled={busy}
                  className="flex-1 py-1.5 rounded bg-emerald-600 text-white font-medium disabled:opacity-60"
                >
                  {busy ? "Setting up…" : "Set alert"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="py-1.5 px-3 rounded border border-gray-300"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function BellIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.5}
      className="w-3.5 h-3.5 shrink-0"
    >
      <path d="M10 2a6 6 0 00-6 6v3.28a2 2 0 01-.6 1.43L2 14.5h16l-1.4-1.79a2 2 0 01-.6-1.43V8a6 6 0 00-6-6z" />
      <path d="M8 16.5a2 2 0 004 0" />
    </svg>
  );
}
