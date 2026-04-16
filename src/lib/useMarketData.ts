"use client";

import { useEffect, useState } from "react";
import type { MarketData } from "./excise/types";

interface UseMarketDataResult {
  data: MarketData | null;
  loading: boolean;
  error: string | null;
  /** When set, overrides the cached values. Persisted to localStorage so it works across pages. */
  override: { brent_usd: number; aud_usd: number } | null;
  setOverride: (o: { brent_usd: number; aud_usd: number } | null) => void;
}

const OVERRIDE_KEY = "fuelsmart-market-override";

function loadOverride(): { brent_usd: number; aud_usd: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(OVERRIDE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.brent_usd === "number" &&
      typeof parsed?.aud_usd === "number" &&
      parsed.brent_usd > 0 &&
      parsed.aud_usd > 0
    ) {
      return { brent_usd: parsed.brent_usd, aud_usd: parsed.aud_usd };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Fetches the cached market data from /api/market-data once on mount.
 * Manual override is persisted to localStorage (`fuelsmart-market-override`) so that
 * a value set from the /excise page survives navigation back to the map.
 */
export function useMarketData(enabled: boolean = true): UseMarketDataResult {
  const [data, setData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [override, setOverrideState] = useState<{ brent_usd: number; aud_usd: number } | null>(
    null,
  );

  // Hydrate override from localStorage on mount
  useEffect(() => {
    setOverrideState(loadOverride());
  }, []);

  // Persist override changes
  const setOverride = (o: { brent_usd: number; aud_usd: number } | null) => {
    setOverrideState(o);
    if (typeof window === "undefined") return;
    if (o) {
      localStorage.setItem(OVERRIDE_KEY, JSON.stringify(o));
    } else {
      localStorage.removeItem(OVERRIDE_KEY);
    }
  };

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
