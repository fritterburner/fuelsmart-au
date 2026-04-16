import { NextResponse } from "next/server";
import { getCachedMarketData } from "@/lib/cache";

/**
 * Returns the cached Brent crude + AUD/USD snapshot used by excise pass-through
 * calculations. Refreshed daily by the /api/cron/refresh cron task.
 *
 * Response shape: `MarketData` (brent_usd, aud_usd, as_of, fetched_at, source, stale).
 * Returns 503 if cache is empty (first deploy before first cron run).
 */
export async function GET() {
  const data = await getCachedMarketData();
  if (!data) {
    return NextResponse.json(
      { error: "Market data not yet available — daily cron has not populated the cache." },
      { status: 503 },
    );
  }
  return NextResponse.json(data);
}
