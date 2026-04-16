"use client";

import { useEffect, useState } from "react";
import type { MarketData } from "./excise/types";

interface UseMarketDataResult {
  data: MarketData | null;
  loading: boolean;
  error: string | null;
  /** When set, overrides the cached values (session-only, set via /excise explainer page). */
  override: { brent_usd: number; aud_usd: number } | null;
  setOverride: (o: { brent_usd: number; aud_usd: number } | null) => void;
}

/**
 * Fetches the cached market data from /api/market-data once on mount.
 * Manual override (set from the /excise page) is session-only, kept in state only.
 */
export function useMarketData(enabled: boolean = true): UseMarketDataResult {
  const [data, setData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [override, setOverride] = useState<{ brent_usd: number; aud_usd: number } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/market-data")
      .then(async (resp) => {
        if (!resp.ok) {
          const body = await resp.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${resp.status}`);
        }
        return resp.json() as Promise<MarketData>;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { data, loading, error, override, setOverride };
}

/** Compute the effective oil/AUD values, applying any manual override. */
export function effectiveMarketValues(
  data: MarketData | null,
  override: { brent_usd: number; aud_usd: number } | null,
): { brent_usd: number; aud_usd: number } | null {
  if (override) return override;
  if (data) return { brent_usd: data.brent_usd, aud_usd: data.aud_usd };
  return null;
}
