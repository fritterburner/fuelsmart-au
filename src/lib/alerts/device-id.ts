"use client";

/**
 * Client-only helper for the pseudonymous device id used by price alerts.
 *
 * This deliberately reuses the *exact same* localStorage key and generation
 * scheme as src/components/UsageBeacon.tsx ("fuelsmart-vid" ->
 * crypto.randomUUID()), per the product decision to have exactly one
 * anonymous identity per device rather than a second one for alerts. If
 * UsageBeacon has already run on this device, this returns the same id;
 * if not (e.g. a user lands on /alerts first), it creates one using the
 * identical scheme so the two stay interchangeable.
 *
 * We can't import UsageBeacon's private helper (it isn't exported), so the
 * ~10 lines of logic are duplicated here intentionally — the contract that
 * matters is the storage key and ID format, not the source file.
 */

const VID_KEY = "fuelsmart-vid";

export function getOrCreateDeviceId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    let vid = window.localStorage.getItem(VID_KEY);
    if (!vid) {
      vid =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      window.localStorage.setItem(VID_KEY, vid);
    }
    return vid;
  } catch {
    // Storage blocked (private mode, etc.) — alerts simply aren't available this session.
    return null;
  }
}
