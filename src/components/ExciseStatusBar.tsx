"use client";

import type { MarketData } from "@/lib/excise/types";
import { BASELINE_OIL_USD, BASELINE_AUD_USD } from "@/lib/excise/baselines";
import { formatAge } from "@/lib/time-format";

interface Props {
  data: MarketData | null;
  loading: boolean;
  error: string | null;
  overrideActive: boolean;
  override?: { brent_usd: number; aud_usd: number } | null;
}

function pct(live: number, base: number): string {
  const delta = ((live - base) / base) * 100;
  const sign = delta >= 0 ? "↑" : "↓";
  return `${sign}${Math.abs(delta).toFixed(1)}%`;
}

export default function ExciseStatusBar({
  data,
  loading,
  error,
  overrideActive,
  override,
}: Props) {
  const baseClass =
    "flex items-center justify-center gap-3 px-3 py-1.5 text-xs font-medium border-b shadow-sm overflow-hidden";

  // Override-only state (no live data, but user has set manual values) — show those so the map is obviously live
  if (!data && overrideActive && override) {
    return (
      <div className={`${baseClass} bg-purple-50 text-purple-800 border-purple-200`}>
        <span className="font-semibold whitespace-nowrap">⛽ Excise mode</span>
        <span className="whitespace-nowrap">
          Oil ${override.brent_usd.toFixed(2)}{" "}
          <span className="opacity-70">({pct(override.brent_usd, BASELINE_OIL_USD)})</span>
        </span>
        <span className="whitespace-nowrap">
          AUD {override.aud_usd.toFixed(4)}{" "}
          <span className="opacity-70">({pct(override.aud_usd, BASELINE_AUD_USD)})</span>
        </span>
        <span className="whitespace-nowrap">⚙ manual override</span>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className={`${baseClass} bg-slate-100 text-slate-600 border-slate-200`}>
        <span>Loading live market data…</span>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className={`${baseClass} bg-red-50 text-red-700 border-red-200 flex-wrap`}>
        <span>⚠ Live market data unavailable — map pins stay on the default palette until you set values.</span>
        <a href="/excise" className="underline font-semibold">
          Set manual override →
        </a>
      </div>
    );
  }

  if (!data) return null;

  const bg = overrideActive
    ? "bg-purple-50 text-purple-800 border-purple-200"
    : data.stale
    ? "bg-amber-50 text-amber-900 border-amber-200"
    : "bg-emerald-50 text-emerald-900 border-emerald-200";

  return (
    <div className={`${baseClass} ${bg}`}>
      <span className="font-semibold whitespace-nowrap">⛽ Excise mode</span>
      <span className="whitespace-nowrap">
        Oil ${data.brent_usd.toFixed(2)}{" "}
        <span className="opacity-70">({pct(data.brent_usd, BASELINE_OIL_USD)})</span>
      </span>
      <span className="whitespace-nowrap">
        AUD {data.aud_usd.toFixed(4)}{" "}
        <span className="opacity-70">({pct(data.aud_usd, BASELINE_AUD_USD)})</span>
      </span>
      {overrideActive ? (
        <span className="whitespace-nowrap">⚙ manual override</span>
      ) : (
        <span className="whitespace-nowrap opacity-70">{formatAge(data.fetched_at)}</span>
      )}
      {data.stale && !overrideActive && (
        <span className="whitespace-nowrap font-semibold">⚠ stale</span>
      )}
    </div>
  );
}
