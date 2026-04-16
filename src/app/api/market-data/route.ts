import { NextResponse } from "next/server";
import { cacheMarketData, getCachedMarketData } from "@/lib/cache";
import { fetchLiveMarketData } from "@/lib/excise/fetch-market-data";
import type { MarketData } from "@/lib/excise/types";

/**
 * Returns the cached Brent crude + AUD/USD snapshot used by excise pass-through
 * calculations. Refreshed daily by the /api/cron/refresh cron task, but also
 * populates the cache on-demand if the first user hits this endpoint before
 * the first cron run.
 *
 * Response shape: `MarketData` (brent_usd, aud_usd, as_of, fetched_at, source, stale).
 * Returns 503 only if both cache and live fetch fail.
 */

// In-process lock prevents thundering herd: if N concurrent users hit a cold
// cache, they all await the same fetch Promise instead of each firing their own.
// Module-scoped — resets per cold start, which is fine.
let inflightFetch: Promise<MarketData> | null = null;

export async function GET() {
  const cached = await getCachedMarketData();
  if (cached) {
    return NextResponse.json(cached);
  }

  // Cold cache — fetch on demand.
  try {
    const data = await populateCache();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 503 },
    );
  }
}

async function populateCache(): Promise<MarketData> {
  if (inflightFetch) {
    return inflightFetch;
  }
  inflightFetch = (async () => {
    try {
      const fetched = await fetchLiveMarketData();
      await cacheMarketData(fetched);
      // Re-read via getCachedMarketData so we get the `stale` flag consistent with cron-populated reads.
      const stored = await getCachedMarketData();
      if (!stored) {
        // Shouldn't happen — we just wrote it — but degrade gracefully.
        return {
          ...fetched,
          fetched_at: new Date().toISOString(),
          stale: false,
        };
      }
      return stored;
    } finally {
      inflightFetch = null;
    }
  })();
  return inflightFetch;
}
