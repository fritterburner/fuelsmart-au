"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FUEL_TYPES } from "@/lib/fuel-codes";
import { FuelCode, StateCode } from "@/lib/types";
import { regionsForState, nearestRegion, regionById } from "@/lib/regions";
import PriceHistoryChart from "@/components/PriceHistoryChart";

const STATES: StateCode[] = ["NSW", "ACT", "VIC", "QLD", "SA", "WA", "TAS", "NT"];

interface StatePoint {
  date: string;
  avg: number | null;
  min: number | null;
}

interface ForecastPoint {
  date: string;
  projected: number;
  lower: number;
  upper: number;
}

interface Forecast {
  asOf: string;
  lastPrice: number | null;
  forecast: ForecastPoint[];
  recommendation: "buy_now" | "wait" | "neutral";
  rationale: string;
  confidence: "low" | "medium";
  events: { date: string; label: string; impactCpl: number }[];
}

const REC_STYLE: Record<string, { label: string; cls: string }> = {
  buy_now: { label: "Fill up now", cls: "bg-amber-100 text-amber-900 border-amber-300" },
  wait: { label: "You can wait", cls: "bg-emerald-100 text-emerald-900 border-emerald-300" },
  neutral: { label: "No clear move", cls: "bg-gray-100 text-gray-700 border-gray-300" },
};

export default function HistoryPage() {
  const [state, setState] = useState<StateCode>("NSW");
  const [region, setRegion] = useState<string>(""); // "" = whole state
  const [fuel, setFuel] = useState<FuelCode>("U91");
  const [series, setSeries] = useState<StatePoint[]>([]);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [loading, setLoading] = useState(true);

  // Default to the region nearest the last map centre (persisted by the map).
  useEffect(() => {
    function applyMapCentreDefault() {
      try {
        const raw = localStorage.getItem("fuelsmart-mappos");
        if (!raw) return;
        const pos = JSON.parse(raw);
        if (typeof pos?.lat !== "number" || typeof pos?.lng !== "number") return;
        const rid = nearestRegion(pos.lat, pos.lng);
        const reg = rid ? regionById(rid) : undefined;
        if (reg) {
          setState(reg.state);
          setRegion(reg.id);
        }
      } catch {
        /* ignore — fall back to Whole NSW */
      }
    }
    applyMapCentreDefault();
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      const scope = region ? `region/${region}` : `state/${state}`;
      try {
        const [hRes, fRes] = await Promise.all([
          fetch(`/api/history/${scope}?fuel=${fuel}&days=30`),
          fetch(`/api/forecast/${scope}?fuel=${fuel}`),
        ]);
        const hData = await hRes.json();
        const fData = await fRes.json();
        if (active) {
          setSeries(hData.series ?? []);
          setForecast(fData.forecast ?? null);
        }
      } catch {
        if (active) {
          setSeries([]);
          setForecast(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [state, region, fuel]);

  const primaryFuels = FUEL_TYPES.filter((f) => f.primary);
  const regionOptions = regionsForState(state);

  // Combined chart: last ~14 days of history joined to the 7-day projection.
  const recent = series.slice(-14);
  const fc = forecast?.forecast ?? [];
  const joinPrice = forecast?.lastPrice ?? (recent.length ? recent[recent.length - 1].avg : null);
  const allDates = [...recent.map((p) => p.date), ...fc.map((f) => f.date)];
  const joinIdx = recent.length - 1;

  const recentLine = allDates.map((date, i) => ({ date, value: i < recent.length ? recent[i].avg : null }));
  const projLine = allDates.map((date, i) => {
    if (i === joinIdx) return { date, value: joinPrice };
    if (i >= recent.length) return { date, value: fc[i - recent.length].projected };
    return { date, value: null };
  });
  const highLine = allDates.map((date, i) => {
    if (i === joinIdx) return { date, value: joinPrice };
    if (i >= recent.length) return { date, value: fc[i - recent.length].upper };
    return { date, value: null };
  });
  const lowLine = allDates.map((date, i) => {
    if (i === joinIdx) return { date, value: joinPrice };
    if (i >= recent.length) return { date, value: fc[i - recent.length].lower };
    return { date, value: null };
  });

  const rec = forecast ? REC_STYLE[forecast.recommendation] : null;

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <div className="sticky top-0 z-30 bg-slate-800 text-white px-3 py-3 flex items-center gap-3 shadow-md">
        <Link
          href="/"
          className="flex items-center justify-center w-10 h-10 min-h-[44px] min-w-[44px] rounded-full hover:bg-slate-700 active:bg-slate-600 transition-colors text-emerald-400"
          aria-label="Back to map"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path
              fillRule="evenodd"
              d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
              clipRule="evenodd"
            />
          </svg>
        </Link>
        <h1 className="font-bold text-lg">Price history &amp; 7-day outlook</h1>
      </div>

      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="State">
          {STATES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setState(s);
                setRegion("");
              }}
              aria-pressed={state === s}
              className={`min-h-[40px] px-3 rounded-lg border text-sm font-medium transition-colors ${
                state === s
                  ? "bg-emerald-600 text-white border-emerald-500"
                  : "bg-white text-slate-900 border-slate-300 hover:bg-slate-100"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-gray-700">
            Region:{" "}
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="min-h-[40px] px-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900"
            >
              <option value="">Whole {state}</option>
              {regionOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Fuel type">
          {primaryFuels.map((f) => (
            <button
              key={f.code}
              type="button"
              onClick={() => setFuel(f.code)}
              aria-pressed={fuel === f.code}
              className={`min-h-[40px] px-3 rounded-lg border text-sm font-medium transition-colors ${
                fuel === f.code
                  ? "bg-emerald-600 text-white border-emerald-500"
                  : "bg-white text-slate-900 border-slate-300 hover:bg-slate-100"
              }`}
            >
              {f.short}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="py-10 text-center text-sm text-gray-500">Loading…</div>
          </div>
        ) : (
          <>
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <PriceHistoryChart
                series={[
                  { label: "Recent", color: "#0f766e", points: recentLine },
                  { label: "Forecast", color: "#22c55e", points: projLine },
                  { label: "High", color: "#cbd5e1", points: highLine },
                  { label: "Low", color: "#cbd5e1", points: lowLine },
                ]}
              />
            </div>

            {forecast && rec && (
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-sm font-semibold ${rec.cls}`}>
                    {rec.label}
                  </span>
                  <span className="text-xs text-gray-500">forecast confidence: {forecast.confidence}</span>
                </div>
                <p className="text-sm text-gray-700">{forecast.rationale}</p>
                {forecast.events.length > 0 && (
                  <ul className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded p-2 space-y-1">
                    {forecast.events.map((e) => (
                      <li key={e.date}>
                        <strong>{e.date}:</strong> {e.label} ({e.impactCpl > 0 ? "+" : ""}
                        {e.impactCpl} c/L)
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-[11px] text-gray-400">
                  Estimate only — fuel prices are volatile, so treat the outlook as a guide, not a guarantee.
                </p>
              </div>
            )}
          </>
        )}

        <p className="text-xs text-gray-500 leading-relaxed">
          Daily snapshots come from the live state feeds. Pick a region for a
          sharper read — metro and country prices move differently. The outlook
          blends the recent price cycle with known policy events; it sharpens as
          more history accrues.
        </p>
      </div>
    </div>
  );
}
