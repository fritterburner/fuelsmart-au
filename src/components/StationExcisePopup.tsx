"use client";

import { useState } from "react";
import type { Station, FuelCode } from "@/lib/types";
import type { Verdict, NearestBaselineResult, VerdictResult } from "@/lib/excise/types";
import { EXCISE_CUT_CPL } from "@/lib/excise/baselines";

interface Props {
  station: Station;
  displayFuel: FuelCode;
  pumpPriceCpl: number;
  pumpPriceUpdated: string;
  verdict: VerdictResult;
  nearest: NearestBaselineResult;
}

const VERDICT_LABELS: Record<Verdict, { label: string; bg: string; text: string }> = {
  full: { label: "Full pass-through", bg: "bg-emerald-600", text: "text-white" },
  partial: { label: "Partial pass-through", bg: "bg-amber-500", text: "text-white" },
  none: { label: "Not passed through", bg: "bg-red-600", text: "text-white" },
  "price-rose": { label: "Price rose — excise irrelevant", bg: "bg-blue-600", text: "text-white" },
  na: { label: "Not applicable", bg: "bg-gray-500", text: "text-white" },
};

const CONFIDENCE_LABELS = {
  high: "high confidence",
  medium: "medium confidence",
  low: "rough estimate",
};

export default function StationExcisePopup({
  station,
  displayFuel,
  pumpPriceCpl,
  pumpPriceUpdated,
  verdict,
  nearest,
}: Props) {
  const [showWorking, setShowWorking] = useState(false);
  const meta = VERDICT_LABELS[verdict.verdict];
  const pct = Math.round(verdict.passthroughPct);

  return (
    <div className="text-sm min-w-[260px]">
      <strong>{station.name}</strong>
      <div className="text-xs text-gray-600 mb-2">
        {station.address}, {station.suburb} {station.state} {station.postcode}
      </div>

      {/* Verdict badge */}
      <div className={`${meta.bg} ${meta.text} rounded px-2 py-1.5 mb-2`}>
        <div className="font-semibold">{meta.label}</div>
        {verdict.verdict !== "na" && verdict.verdict !== "price-rose" && (
          <div className="text-xs opacity-90">
            {pct}% of the {EXCISE_CUT_CPL.toFixed(1)}¢ cut reflected at the pump
          </div>
        )}
      </div>

      {/* Pump price + fuel */}
      <div className="flex justify-between gap-2 text-xs text-gray-700 mb-1">
        <span>
          {displayFuel} at pump
        </span>
        <strong>{pumpPriceCpl.toFixed(1)} ¢/L</strong>
      </div>
      {verdict.verdict !== "na" && (
        <div className="flex justify-between gap-2 text-xs text-gray-700 mb-1">
          <span>Expected (no gouge)</span>
          <span>{verdict.expectedPriceCpl.toFixed(1)} ¢/L</span>
        </div>
      )}
      <div className="flex justify-between gap-2 text-xs text-gray-700">
        <span>Baseline: {nearest.city.name}</span>
        <span className="text-gray-500">
          {nearest.distanceKm.toFixed(0)}km, {CONFIDENCE_LABELS[nearest.confidence]}
        </span>
      </div>

      {/* Expandable working */}
      {verdict.verdict !== "na" && (
        <>
          <button
            onClick={() => setShowWorking((s) => !s)}
            className="text-xs text-blue-700 underline mt-2"
          >
            {showWorking ? "Hide" : "Show"} working
          </button>
          {showWorking && (
            <div className="mt-1 text-xs text-gray-700 bg-gray-50 rounded p-2 space-y-0.5">
              <div className="flex justify-between">
                <span>Baseline ({nearest.city.name})</span>
                <span>
                  {(displayFuel === "DL" || displayFuel === "PD"
                    ? nearest.city.dieselBaseline
                    : nearest.city.ulpBaseline
                  ).toFixed(1)} ¢/L
                </span>
              </div>
              <div className="flex justify-between">
                <span>Less excise cut</span>
                <span>−{EXCISE_CUT_CPL.toFixed(1)} ¢/L</span>
              </div>
              <div className="flex justify-between">
                <span>Oil impact</span>
                <span>
                  {verdict.oilImpactCpl >= 0 ? "+" : ""}
                  {verdict.oilImpactCpl.toFixed(2)} ¢/L
                </span>
              </div>
              <div className="flex justify-between">
                <span>FX (AUD) impact</span>
                <span>
                  {verdict.fxImpactCpl >= 0 ? "+" : ""}
                  {verdict.fxImpactCpl.toFixed(2)} ¢/L
                </span>
              </div>
              <div className="flex justify-between font-semibold border-t border-gray-300 pt-0.5 mt-0.5">
                <span>Expected</span>
                <span>{verdict.expectedPriceCpl.toFixed(1)} ¢/L</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Actual pump</span>
                <span>{pumpPriceCpl.toFixed(1)} ¢/L</span>
              </div>
              <div className="flex justify-between font-semibold text-gray-900">
                <span>Gouge / shortfall</span>
                <span>
                  {(pumpPriceCpl - verdict.expectedPriceCpl >= 0 ? "+" : "")}
                  {(pumpPriceCpl - verdict.expectedPriceCpl).toFixed(2)} ¢/L
                </span>
              </div>
            </div>
          )}
        </>
      )}

      <div className="text-xs text-gray-500 mt-2">
        Price updated: {new Date(pumpPriceUpdated).toLocaleDateString()}
      </div>
      <a
        href="/excise"
        className="block text-xs text-blue-700 underline mt-1"
      >
        Learn how this is calculated →
      </a>
    </div>
  );
}
