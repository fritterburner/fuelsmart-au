/**
 * Orchestrator: fetch live Brent crude + AUD/USD.
 *
 * Tries free public sources first (Stooq for Brent, Frankfurter for AUD/USD).
 * If either fails AND ANTHROPIC_API_KEY is set, falls back to Anthropic web_search.
 * Otherwise throws — caller (cron or /api/market-data) decides what to do.
 *
 * Called from the daily cron in `src/lib/refresh.ts` and on cache-miss from
 * `/api/market-data`. Result is cached in Redis via `cacheMarketData()`.
 */

import { fetchFrankfurterAUD } from "./fetchers/frankfurter";
import { fetchStooqBrent } from "./fetchers/stooq";
import { fetchAnthropicMarketData } from "./fetchers/anthropic";

export interface FetchedMarketData {
  brent_usd: number;
  aud_usd: number;
  as_of: string;
  source: string;
}

export async function fetchLiveMarketData(): Promise<FetchedMarketData> {
  try {
    const [oil, aud] = await Promise.all([fetchStooqBrent(), fetchFrankfurterAUD()]);
    return {
      brent_usd: oil,
      aud_usd: aud,
      as_of: todayISO(),
      source: "frankfurter+stooq",
    };
  } catch (freeErr) {
    const freeMsg = (freeErr as Error).message;
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        return await fetchAnthropicMarketData();
      } catch (anthropicErr) {
        const anthropicMsg = (anthropicErr as Error).message;
        throw new Error(
          `Free sources failed (${freeMsg}); Anthropic fallback also failed (${anthropicMsg})`,
        );
      }
    }
    throw new Error(
      `Free market-data sources failed (${freeMsg}); no ANTHROPIC_API_KEY to fall back to`,
    );
  }
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
