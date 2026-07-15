import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { ALL_STATES, stateSlug } from "@/lib/state-meta";
import { getCachedStations } from "@/lib/cache";

// Rebuild roughly hourly — enough for a marketing sitemap without hammering
// Redis on every crawler hit (station freshness itself is handled by each
// page's own ISR revalidate).
export const revalidate = 3600;

type Entry = MetadataRoute.Sitemap[number];

const STATIC_ROUTES: { path: string; priority: number; changeFrequency: Entry["changeFrequency"] }[] = [
  { path: "/", priority: 1.0, changeFrequency: "hourly" },
  { path: "/trends", priority: 0.9, changeFrequency: "hourly" },
  { path: "/history", priority: 0.7, changeFrequency: "daily" },
  { path: "/trip", priority: 0.6, changeFrequency: "monthly" },
  { path: "/fill-up", priority: 0.6, changeFrequency: "monthly" },
  { path: "/compare", priority: 0.5, changeFrequency: "monthly" },
  { path: "/discounts", priority: 0.5, changeFrequency: "monthly" },
  { path: "/additives", priority: 0.4, changeFrequency: "monthly" },
  { path: "/excise", priority: 0.4, changeFrequency: "monthly" },
  { path: "/data-freshness", priority: 0.4, changeFrequency: "monthly" },
  { path: "/privacy", priority: 0.2, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.2, changeFrequency: "yearly" },
];

// Google's own limit is 50,000 URLs/sitemap; we cap far lower than that so a
// sitemap of individually-obscure station pages doesn't dilute crawl budget
// once VIC/SA bring the fleet up from ~2,700 stations. Above this, ship state
// pages only — /prices/[state] already lists each state's cheapest stations
// with a link to /station/[id], so nothing is unreachable, just not directly
// sitemapped.
const MAX_STATION_URLS = 5000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const entries: MetadataRoute.Sitemap = STATIC_ROUTES.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  for (const state of ALL_STATES) {
    entries.push({
      url: `${SITE_URL}/prices/${stateSlug(state)}`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 0.8,
    });
  }

  try {
    const stations = await getCachedStations();
    if (stations && stations.length > 0 && stations.length <= MAX_STATION_URLS) {
      for (const s of stations) {
        entries.push({
          url: `${SITE_URL}/station/${s.id}`,
          lastModified: now,
          changeFrequency: "daily",
          priority: 0.4,
        });
      }
    }
  } catch {
    // Redis unavailable — ship the sitemap without station URLs rather than
    // fail the whole thing.
  }

  return entries;
}
