"use client";

import { useEffect } from "react";

/**
 * Registers the service worker (installability + offline fallback). Waits for
 * window load so it never competes with first paint. Failures are swallowed —
 * the app works fine without it.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* SW optional — ignore */
      });
    };
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
