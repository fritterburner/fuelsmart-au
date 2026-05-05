"use client";

import type { FuelCode } from "@/lib/types";
import { FUEL_TYPES } from "@/lib/fuel-codes";

interface Props {
  startingFuelPct: number;
  arriveFull: boolean;
  reservePct: number;
  allowFallback: boolean;
  tank: number;
  fuel: FuelCode;
  /** True iff route touches NT and the chosen fuel has a fallback chain. */
  showFallbackToggle: boolean;
  onStartingFuelChange: (v: number) => void;
  onArriveFullChange: (v: boolean) => void;
  onReserveChange: (v: number) => void;
  onAllowFallbackChange: (v: boolean) => void;
}

export default function AdvancedSettings({
  startingFuelPct,
  arriveFull,
  reservePct,
  allowFallback,
  tank,
  fuel,
  showFallbackToggle,
  onStartingFuelChange,
  onArriveFullChange,
  onReserveChange,
  onAllowFallbackChange,
}: Props) {
  const startingLitres = Math.round((startingFuelPct / 100) * tank);
  const fuelName = FUEL_TYPES.find((f) => f.code === fuel)?.name ?? fuel;

  return (
    <details className="group rounded-lg border border-gray-200 bg-gray-50">
      <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 active:bg-gray-100 rounded-lg flex items-center justify-between">
        <span>Advanced settings</span>
        <span className="text-xs text-gray-500 group-open:hidden">
          starting fuel, reserve, full-tank, fallback fuel
        </span>
      </summary>
      <div className="px-3 pb-3 pt-2 space-y-4 border-t border-gray-200">
        {/* Starting Fuel Level slider */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Starting fuel level
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={startingFuelPct}
              onChange={(e) => onStartingFuelChange(Number(e.target.value))}
              className="flex-1 min-h-[44px] accent-emerald-600"
            />
            <span className="text-sm font-medium text-gray-700 whitespace-nowrap min-w-[110px] text-right">
              {startingFuelPct}% ({startingLitres}L of {tank}L)
            </span>
          </div>
        </div>

        {/* Optimised over-buy toggle (internally `arriveFull`) */}
        <label className="flex items-start gap-3 cursor-pointer">
          <div className="relative mt-0.5">
            <input
              type="checkbox"
              checked={arriveFull}
              onChange={(e) => onArriveFullChange(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-300 rounded-full peer-checked:bg-emerald-500 transition-colors" />
            <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform" />
          </div>
          <span className="text-sm text-gray-700 leading-snug">
            Let Optimised over-buy at cheap stops
            <span className="block text-xs text-gray-500 mt-0.5">
              When on, Optimised fills to brim at the cheapest stop even if
              you&apos;ll arrive with more than you need. The other two
              strategies always fill to brim regardless.
            </span>
          </span>
        </label>

        {/* Fuel reserve threshold slider */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Minimum fuel reserve
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={30}
              step={5}
              value={reservePct}
              onChange={(e) => onReserveChange(Number(e.target.value))}
              className="flex-1 min-h-[44px] accent-emerald-600"
            />
            <span className="text-sm font-medium text-gray-700 whitespace-nowrap min-w-[110px] text-right">
              {reservePct}% ({Math.round((reservePct / 100) * tank)}L of {tank}L)
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Never arrive at a stop with less than this in the tank
          </p>
        </div>

        {/* LAF/OPAL fallback toggle — only relevant when route touches NT
            and the chosen fuel has a fallback chain. */}
        {showFallbackToggle && (
          <label className="flex items-center gap-3 cursor-pointer">
            <div className="relative">
              <input
                type="checkbox"
                checked={allowFallback}
                onChange={(e) => onAllowFallbackChange(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-300 rounded-full peer-checked:bg-emerald-500 transition-colors" />
              <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform" />
            </div>
            <span className="text-sm text-gray-700">
              Use Low Aromatic / OPAL fuel where {fuelName} unavailable
              <span className="block text-xs text-gray-500">
                Remote NT communities sell unleaded as LAF/OPAL — same engine.
              </span>
            </span>
          </label>
        )}
      </div>
    </details>
  );
}
