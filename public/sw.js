/*
 * FuelSmart service worker. Deliberately conservative for a live-data app:
 *  - /api/* and map tiles are NEVER cached (prices must be fresh).
 *  - Next static assets are cache-first (immutable, content-hashed).
 *  - Navigations are network-first, falling back to a cached offline page.
 */
const CACHE = "fuelsmart-v1";
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
