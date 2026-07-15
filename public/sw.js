/*
 * FuelSmart service worker. Deliberately conservative for a live-data app:
 *  - /api/* and map tiles are NEVER cached (prices must be fresh).
 *  - Next static assets are cache-first (immutable, content-hashed).
 *  - Navigations are network-first, falling back to a cached offline page.
 *  - Web Push: shows a notification for incoming price alerts and focuses
 *    (or opens) the app on click. See src/lib/alerts/push.ts for what we send.
 */
const CACHE = "fuelsmart-v2"; // bumped: added push + notificationclick handlers
const PRECACHE = ["/offline.html", "/manifest.webmanifest", "/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }

  // Same-origin only; let the browser handle cross-origin (tiles, fonts CDN).
  if (url.origin !== self.location.origin) return;

  // Live data — always hit the network, never cache.
  if (url.pathname.startsWith("/api/")) return;

  // App navigations: network-first with an offline fallback.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match("/offline.html")));
    return;
  }

  // Static, content-hashed assets and icons: cache-first.
  const isStatic =
    url.pathname.startsWith("/_next/static") ||
    PRECACHE.includes(url.pathname) ||
    /\.(png|svg|ico|webmanifest|woff2?)$/.test(url.pathname);

  if (isStatic) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
            return res;
          })
      )
    );
  }
});

// --- Web Push: price alerts ---
// Payload shape sent by src/lib/alerts/push.ts: { title, body, url, tag }.
// Falls back to a generic message if the payload is missing/unparseable so a
// malformed push never silently does nothing.
self.addEventListener("push", (event) => {
  let data = { title: "FuelSmart price alert", body: "One of your fuel prices moved.", url: "/alerts", tag: "fuelsmart-price-alert" };
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      // Non-JSON push (shouldn't happen from our server) — keep the fallback copy.
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag,
      data: { url: data.url || "/alerts" },
    })
  );
});

// Focuses an already-open FuelSmart tab if one exists, otherwise opens a new one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data && event.notification.data.url ? event.notification.data.url : "/alerts";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
