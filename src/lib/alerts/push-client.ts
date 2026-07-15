"use client";

import type { PushSubscriptionJSON } from "./types";

/** Converts the VAPID public key (base64url) into the Uint8Array applicationServerKey wants. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** True on iOS/iPadOS Safari — push there only works once the PWA is added to the home screen. */
export function isIOSDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window);
}

/** True once the app is running as an installed PWA (home screen / standalone window), not a browser tab. */
export function isStandaloneDisplayMode(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.("(display-mode: standalone)").matches || nav.standalone === true;
}

/** iOS requires home-screen install before push works at all; everywhere else it "just works". */
export function needsIOSInstallGuidance(): boolean {
  return isIOSDevice() && !isStandaloneDisplayMode();
}

export async function getExistingSubscription(): Promise<PushSubscriptionJSON | null> {
  if (!pushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  const sub = await registration?.pushManager.getSubscription();
  return sub ? (sub.toJSON() as PushSubscriptionJSON) : null;
}

/**
 * Registers the service worker (if needed), requests notification permission,
 * and subscribes to push. Returns null (never throws) if the user declines
 * permission or the platform doesn't support push — callers should treat
 * that as "can't enable alerts right now" rather than a hard error.
 */
export async function subscribeToPush(vapidPublicKey: string): Promise<PushSubscriptionJSON | null> {
  if (!pushSupported()) return null;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  const existing = await registration.pushManager.getSubscription();
  const sub =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
    }));

  return sub.toJSON() as PushSubscriptionJSON;
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!pushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration();
  const sub = await registration?.pushManager.getSubscription();
  await sub?.unsubscribe();
}
