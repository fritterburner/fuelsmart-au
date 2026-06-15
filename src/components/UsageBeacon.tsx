"use client";

import { useEffect } from "react";

/**
 * Fires a once-per-device-per-day "I'm here" ping so we can produce the
 * aggregate New/Returning/Active usage report the SA Fuel Pricing Information
 * Scheme can request (Data Publisher T&Cs cl. 3.7).
 *
 * Privacy-first: the only thing stored on the device is an opaque random ID in
 * localStorage (no account, no PII). If storage is blocked (private mode), it
 * silently does nothing — usage stats are best-effort, never user-facing.
 */

const VID_KEY = "fuelsmart-vid";
const LAST_PING_KEY = "fuelsmart-vid-lastping";

function getOrCreateVid(): string {
  let vid = localStorage.getItem(VID_KEY);
  if (!vid) {
    vid =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(VID_KEY, vid);
  }
  return vid;
}

export default function UsageBeacon() {
  useEffect(() => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      if (localStorage.getItem(LAST_PING_KEY) === today) return; // one ping per day

      const vid = getOrCreateVid();
      localStorage.setItem(LAST_PING_KEY, today);

      fetch("/api/usage/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vid }),
        keepalive: true,
      }).catch(() => {
        /* best-effort; ignore network errors */
      });
    } catch {
      /* storage blocked — skip silently */
    }
  }, []);

  return null;
}
