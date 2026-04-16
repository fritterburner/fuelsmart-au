"use client";

import { useMemo } from "react";
import {
  BASELINE_OIL_USD,
  BASELINE_AUD_USD,
  EXCISE_CUT_CPL,
  FX_RATIO,
  CRUDE_RATIO,
  BASELINE_CITIES,
  NATIONAL_AVERAGE_BASELINE,
} from "@/lib/excise/baselines";
import { calcVerdict } from "@/lib/excise/calc";
import { useMarketData, effectiveMarketValues } from "@/lib/useMarketData";
import ExciseManualOverride from "@/components/ExciseManualOverride";

export default function ExciseExplainerPage() {
  const { data, loading, error, override, setOverride } = useMarketData(true);
  const effective = effectiveMarketValues(data, override);

  // Worked example: Sydney ULP, full pass-through scenario
  const sydney = BASELINE_CITIES.find((c) => c.name === "Sydney")!;
  const workedExample = useMemo(() => {
    if (!effective) return null;
    return calcVerdict({
      pumpPriceCpl: sydney.ulpBaseline - EXCISE_CUT_CPL, // hypothetical "fair" pump price
      fuel: "ULP",
      baseline: sydney,
      liveOilUsd: effective.brent_usd,
      liveAudUsd: effective.aud_usd,
    });
  }, [effective, sydney]);

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Sticky header with back navigation */}
      <div className="sticky top-0 z-30 bg-slate-800 text-white px-3 py-3 flex items-center gap-3 shadow-md">
        <a
          href="/"
          className="flex items-center justify-center w-10 h-10 min-h-[44px] min-w-[44px] rounded-full hover:bg-slate-700 active:bg-slate-600 transition-colors text-emerald-400"
          aria-label="Back to map"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
          </svg>
        </a>
        <h1 className="font-bold text-lg">How excise is calculated</h1>
      </div>

      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
        {/* Intro */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-2">The federal excise cut (1 Apr – 30 Jun 2026)</h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            The Commonwealth halved the federal fuel excise from 52.6¢ to 26.3¢ per litre — a {EXCISE_CUT_CPL.toFixed(1)}¢
            saving that should reach the bowser. This page explains how FuelSmart&apos;s excise mode checks whether
            a given station is passing the cut on, after accounting for global oil moves and the AUD exchange rate.
          </p>
          <p className="text-sm text-gray-700 leading-relaxed mt-2">
            Read more at the{" "}
            <a
              href="https://www.accc.gov.au/consumers/petrol-diesel-and-lpg/petrol-price-cycles"
              className="underline text-blue-700"
              target="_blank"
              rel="noopener noreferrer"
            >
              ACCC fuel price monitoring page
            </a>
            .
          </p>
        </section>

        {/* Live market data card */}
        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-2">Live market data</h2>
          {loading && !data && <p className="text-sm text-gray-600">Loading…</p>}
          {error && !data && (
            <p className="text-sm text-red-700">
              ⚠ Couldn&apos;t load live market data: {error}. Use the manual override below to explore scenarios.
            </p>
          )}
          {data && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500">Brent crude</div>
                <div className="text-2xl font-bold text-gray-900">${data.brent_usd.toFixed(2)}</div>
                <div className="text-xs text-gray-500">
                  vs baseline ${BASELINE_OIL_USD.toFixed(2)} (31 Mar 2026)
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500">AUD/USD</div>
                <div className="text-2xl font-bold text-gray-900">{data.aud_usd.toFixed(4)}</div>
                <div className="text-xs text-gray-500">
                  vs baseline {BASELINE_AUD_USD.toFixed(4)}
                </div>
              </div>
              <div className="col-span-2 text-xs text-gray-500 border-t border-gray-100 pt-2">
                Source: {data.source} · as of {data.as_of} · fetched{" "}
                {new Date(data.fetched_at).toLocaleString()}
                {data.stale && <span className="text-amber-700 font-semibold"> · ⚠ stale (&gt;36h old)</span>}
              </div>
            </div>
          )}
        </section>

        {/* Manual override */}
        <section>
          <ExciseManualOverride
            currentOverride={override}
            onApply={setOverride}
            liveOil={data?.brent_usd ?? null}
            liveAud={data?.aud_usd ?? null}
          />
        </section>

        {/* Formula */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-2">The formula</h2>
          <div className="rounded-lg bg-gray-900 text-gray-100 text-xs font-mono p-4 overflow-x-auto">
            <div>oil_change_pct = (live_oil − {BASELINE_OIL_USD.toFixed(2)}) / {BASELINE_OIL_USD.toFixed(2)} × 100</div>
            <div>oil_impact = oil_change_pct × crude_ratio  <span className="text-gray-400">// ULP {CRUDE_RATIO.ULP}, Diesel {CRUDE_RATIO.DIESEL}</span></div>
            <div>fx_change_pct = ({BASELINE_AUD_USD.toFixed(4)} − live_aud) / {BASELINE_AUD_USD.toFixed(4)} × 100</div>
            <div>fx_impact = fx_change_pct × {FX_RATIO}</div>
            <div>expected = city_baseline − {EXCISE_CUT_CPL.toFixed(1)} + oil_impact + fx_impact</div>
            <div>passthrough = {EXCISE_CUT_CPL.toFixed(1)} − (pump − expected)</div>
            <div>passthrough_pct = passthrough / {EXCISE_CUT_CPL.toFixed(1)} × 100</div>
          </div>
          <p className="text-xs text-gray-600 mt-2">
            Verdict: ≥90% = green (full), 60–89% = amber (partial), &lt;60% = red (none), pump &gt; baseline = blue (price rose).
          </p>
        </section>

        {/* Worked example */}
        {workedExample && effective && (
          <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Worked example — Sydney ULP</h2>
            <p className="text-xs text-gray-600 mb-3">
              Using current market data (oil ${effective.brent_usd.toFixed(2)}, AUD {effective.aud_usd.toFixed(4)})
              and Sydney&apos;s ULP baseline ({sydney.ulpBaseline.toFixed(1)}¢/L).
            </p>
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="py-1 text-gray-700">Baseline (Sydney ULP, 31 Mar 2026)</td>
                  <td className="py-1 text-right font-mono">{sydney.ulpBaseline.toFixed(1)} ¢/L</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-1 text-gray-700">Less excise cut</td>
                  <td className="py-1 text-right font-mono">−{EXCISE_CUT_CPL.toFixed(1)} ¢/L</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-1 text-gray-700">Oil impact (at current crude)</td>
                  <td className="py-1 text-right font-mono">
                    {workedExample.oilImpactCpl >= 0 ? "+" : ""}
                    {workedExample.oilImpactCpl.toFixed(2)} ¢/L
                  </td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-1 text-gray-700">FX (AUD) impact</td>
                  <td className="py-1 text-right font-mono">
                    {workedExample.fxImpactCpl >= 0 ? "+" : ""}
                    {workedExample.fxImpactCpl.toFixed(2)} ¢/L
                  </td>
                </tr>
                <tr className="border-t-2 border-gray-300 font-semibold">
                  <td className="py-1.5 text-gray-900">Expected fair pump price</td>
                  <td className="py-1.5 text-right font-mono">
                    {workedExample.expectedPriceCpl.toFixed(1)} ¢/L
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="text-xs text-gray-600 mt-3">
              If a Sydney station is charging more than this, the excise cut isn&apos;t fully reaching drivers.
            </p>
          </section>
        )}

        {/* Baseline table */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Reference baselines (31 Mar 2026)</h2>
          <p className="text-xs text-gray-600 mb-3">
            Each station is mapped to the geographically nearest city here. Distance &gt;150km is flagged as a rough estimate.
            National average: ULP {NATIONAL_AVERAGE_BASELINE.ulpBaseline.toFixed(1)}¢/L, Diesel{" "}
            {NATIONAL_AVERAGE_BASELINE.dieselBaseline.toFixed(1)}¢/L.
          </p>
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
                <tr>
                  <th className="text-left px-3 py-2">City</th>
                  <th className="text-left px-3 py-2">State</th>
                  <th className="text-right px-3 py-2">ULP ¢/L</th>
                  <th className="text-right px-3 py-2">Diesel ¢/L</th>
                </tr>
              </thead>
              <tbody>
                {BASELINE_CITIES.map((city) => (
                  <tr key={city.name} className="border-t border-gray-100">
                    <td className="px-3 py-1.5">{city.name}</td>
                    <td className="px-3 py-1.5 text-gray-600">{city.state}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{city.ulpBaseline.toFixed(1)}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{city.dieselBaseline.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Caveats */}
        <section className="text-xs text-gray-600 leading-relaxed">
          <p>
            <strong>Important caveats.</strong> Individual station prices vary for reasons unrelated to the excise cut —
            brand pricing, local competition, operating costs, and discount cycles. Diesel refining margins can cause
            additional divergence from the formula. A single station&apos;s verdict is a directional signal, not a court
            exhibit. For the strongest signal, look at the overall distribution across a city.
          </p>
        </section>
      </div>
    </div>
  );
}
