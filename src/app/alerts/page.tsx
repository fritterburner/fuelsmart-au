"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { FuelCode, StateCode, Station } from "@/lib/types";
import { FUEL_TYPES } from "@/lib/fuel-codes";
import { getOrCreateDeviceId } from "@/lib/alerts/device-id";
import {
  getExistingSubscription,
  needsIOSInstallGuidance,
  pushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/alerts/push-client";
import {
  addAlert,
  fetchAlerts,
  registerSubscription,
  removeAlert,
  removeAllAlerts,
} from "@/lib/alerts/api-client";
import type { Alert } from "@/lib/alerts/types";

const STATES: StateCode[] = ["NT", "QLD", "WA", "NSW", "ACT", "SA", "VIC", "TAS"];

type PlatformStatus = "checking" | "unsupported" | "needs-ios-install" | "ready";

export default function AlertsPage() {
  const [platform, setPlatform] = useState<PlatformStatus>("checking");
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stationNames, setStationNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [state, setState] = useState<StateCode>("NT");
  const [fuel, setFuel] = useState<FuelCode>("U91");
  const [target, setTarget] = useState("150");

  useEffect(() => {
    const id = getOrCreateDeviceId();
    setDeviceId(id);
    if (!id || !pushSupported()) {
      setPlatform(needsIOSInstallGuidance() ? "needs-ios-install" : "unsupported");
      setLoading(false);
      return;
    }
    setPlatform("ready");
    refresh(id).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh(id: string) {
    try {
      const result = await fetchAlerts(id);
      setSubscribed(result.subscribed);
      setAlerts(result.alerts);

      const stationAlerts = result.alerts.filter((a) => a.scope === "station" && a.stationId);
      const missing = stationAlerts
        .map((a) => a.stationId as string)
        .filter((id2) => !(id2 in stationNames));
      if (missing.length > 0) {
        const entries = await Promise.all(
          missing.map(async (id2) => {
            try {
              const res = await fetch(`/api/station/${encodeURIComponent(id2)}`);
              if (!res.ok) return [id2, id2] as const;
              const data = await res.json();
              const station = data?.station as Station | undefined;
              return [id2, station?.name ?? id2] as const;
            } catch {
              return [id2, id2] as const;
            }
          })
        );
        setStationNames((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your alerts");
    }
  }

  async function handleEnableNotifications() {
    if (!deviceId) return;
    setBusy(true);
    setError(null);
    try {
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) throw new Error("Push notifications aren't configured yet");
      const subscription = await subscribeToPush(vapidKey);
      if (!subscription) throw new Error("Notification permission wasn't granted");
      await registerSubscription(deviceId, subscription);
      setSubscribed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function handleDisableNotifications() {
    if (!deviceId) return;
    setBusy(true);
    setError(null);
    try {
      await unsubscribeFromPush();
      await removeAllAlerts(deviceId);
      setSubscribed(false);
      setAlerts([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function handleAddAlert() {
    if (!deviceId) return;
    setError(null);
    const targetCpl = Number(target);
    if (!Number.isFinite(targetCpl) || targetCpl < 50 || targetCpl > 400) {
      setError("Enter a target between 50 and 400 c/L");
      return;
    }
    if (alerts.length >= 10) {
      setError("You've reached the limit of 10 alerts per device");
      return;
    }
    setBusy(true);
    try {
      if (!subscribed) {
        await handleEnableNotifications();
      }
      const result = await addAlert(deviceId, { scope: "state", state, fuel, targetCpl });
      setAlerts(result.alerts);
      setSubscribed(result.subscribed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveAlert(id: string) {
    if (!deviceId) return;
    setBusy(true);
    try {
      const result = await removeAlert(deviceId, id);
      setAlerts(result.alerts);
      setSubscribed(result.subscribed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <div className="sticky top-0 z-30 bg-slate-800 text-white px-3 py-3 flex items-center gap-3 shadow-md">
        <Link
          href="/"
          className="flex items-center justify-center w-10 h-10 min-h-[44px] min-w-[44px] rounded-full hover:bg-slate-700 active:bg-slate-600 transition-colors text-emerald-400"
          aria-label="Back to map"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path
              fillRule="evenodd"
              d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
              clipRule="evenodd"
            />
          </svg>
        </Link>
        <h1 className="font-bold text-lg">Price Alerts</h1>
      </div>

      <div className="max-w-lg mx-auto p-4 md:p-6 space-y-5 md:space-y-6">
        {loading && <p className="text-sm text-gray-500">Loading…</p>}

        {!loading && platform === "unsupported" && (
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-4 text-sm text-gray-700">
            Push notifications aren&apos;t supported in this browser. Try a recent version of
            Chrome, Edge, Firefox, or Safari.
          </div>
        )}

        {!loading && platform === "needs-ios-install" && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 shadow-sm p-4 text-sm text-amber-900">
            <p className="font-semibold mb-1">One extra step on iPhone/iPad</p>
            <p>
              iOS only allows push notifications for apps added to the Home Screen. Tap the Share
              button in Safari, choose <strong>Add to Home Screen</strong>, then open FuelSmart
              from there and come back to this page.
            </p>
          </div>
        )}

        {!loading && platform === "ready" && (
          <>
            {/* Subscription status */}
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-gray-900">Notifications</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {subscribed
                      ? "Enabled on this device."
                      : "Off — turn on to receive price alerts here."}
                  </div>
                </div>
                {subscribed ? (
                  <button
                    type="button"
                    onClick={handleDisableNotifications}
                    disabled={busy}
                    className="px-3 py-2 min-h-[40px] rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                  >
                    Turn off
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleEnableNotifications}
                    disabled={busy}
                    className="px-3 py-2 min-h-[40px] rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60"
                  >
                    Turn on
                  </button>
                )}
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                {error}
              </div>
            )}

            {/* Add a state-wide alert */}
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-4 space-y-3">
              <div className="font-semibold text-gray-900">Add an alert</div>
              <p className="text-xs text-gray-500">
                Get notified when the cheapest price for a fuel type in a state drops to your
                target. (To alert on one specific station, use the &quot;Alert me&quot; button on
                that station&apos;s map popup.)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">State</label>
                  <select
                    value={state}
                    onChange={(e) => setState(e.target.value as StateCode)}
                    className="w-full px-3 py-2.5 min-h-[44px] border rounded-lg text-base bg-white"
                  >
                    {STATES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Fuel</label>
                  <select
                    value={fuel}
                    onChange={(e) => setFuel(e.target.value as FuelCode)}
                    className="w-full px-3 py-2.5 min-h-[44px] border rounded-lg text-base bg-white"
                  >
                    {FUEL_TYPES.map((f) => (
                      <option key={f.code} value={f.code}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Target price (c/L)
                </label>
                <input
                  type="number"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  min={50}
                  max={400}
                  step={0.1}
                  className="w-full px-3 py-2.5 min-h-[44px] border rounded-lg text-base"
                />
              </div>
              <button
                type="button"
                onClick={handleAddAlert}
                disabled={busy || alerts.length >= 10}
                className="w-full py-2.5 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors disabled:opacity-60"
              >
                {alerts.length >= 10 ? "Limit reached (10)" : busy ? "Adding…" : "Add alert"}
              </button>
            </div>

            {/* Current alerts */}
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-4">
              <div className="font-semibold text-gray-900 mb-2">Your alerts ({alerts.length}/10)</div>
              {alerts.length === 0 ? (
                <p className="text-sm text-gray-500">No alerts yet.</p>
              ) : (
                <ul className="space-y-2">
                  {alerts.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between gap-2 text-sm border border-gray-100 rounded-lg px-3 py-2"
                    >
                      <div>
                        <div className="font-medium text-gray-900">
                          {a.fuel} at or below {a.targetCpl.toFixed(1)}¢/L
                        </div>
                        <div className="text-xs text-gray-500">
                          {a.scope === "state" ? `${a.state} — cheapest station` : stationNames[a.stationId ?? ""] ?? a.stationId}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveAlert(a.id)}
                        disabled={busy}
                        className="text-xs text-red-700 underline disabled:opacity-60"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        <p className="text-xs text-gray-400">
          No accounts, no email, no names — alerts are tied only to a random id stored on this
          device. See the{" "}
          <Link href="/privacy" className="underline">
            privacy page
          </Link>{" "}
          for details.
        </p>
      </div>
    </div>
  );
}
