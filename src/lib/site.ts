/**
 * Canonical production origin, used by layout.tsx (metadataBase), sitemap.ts
 * and robots.ts. Falls back to the example APP_URL already referenced in
 * .github/workflows/refresh-data.yml; override with NEXT_PUBLIC_SITE_URL if
 * the real production domain differs. This is the only place that needs
 * updating; everything else composes off it.
 */
const DEFAULT_SITE_URL = "https://fuelsmart-au.vercel.app";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL).replace(/\/$/, "");
