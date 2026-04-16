"use client";

import { useState } from "react";
import {
  BASELINE_OIL_USD,
  BASELINE_AUD_USD,
} from "@/lib/excise/baselines";

interface Props {
  currentOverride: { brent_usd: number; aud_usd: number } | null;
  onApply: (o: { brent_usd: number; aud_usd: number } | null) => void;
  liveOil: number | null;
  liveAud: number | null;
}

export default function ExciseManualOverride({
  currentOverride,
  onApply,
  liveOil,
  liveAud,
}: Props) {
  const [oil, setOil] = useState<string>(
    currentOverride ? String(currentOverride.brent_usd) : String(liveOil ?? BASELINE_OIL_USD),
  );
  const [aud, setAud] = useState<string>(
    currentOverride ? String(currentOverride.aud_usd) : String(liveAud ?? BASELINE_AUD_USD),
  );

  function apply() {
    const o = parseFloat(oil);
    const a = parseFloat(aud);
    if (!isFinite(o) || o <= 0 || o > 500) return;
    if (!isFinite(a) || a <= 0 || a > 2) return;
    onApply({ brent_usd: o, aud_usd: a });
  }

  function clear() {
    setOil(String(liveOil ?? BASELINE_OIL_USD));
    setAud(String(liveAud ?? BASELINE_AUD_USD));
    onApply(null);
  }

  return (
    <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
      <h3 className="font-semibold text-purple-900 mb-1">Manual override</h3>
      <p className="text-sm text-purple-800 mb-3">
        Plug in your own oil and AUD figures to see how the verdicts change. Session-only — clears on reload.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <label className="block">
          <span className="block text-xs text-purple-900 mb-1">Brent crude USD/bbl</span>
          <input
            type="number"
            step="0.01"
            min="1"
            max="500"
            value={oil}
            onChange={(e) => setOil(e.target.value)}
            className="w-full px-3 py-2 min-h-[44px] border border-purple-300 rounded text-base bg-white"
          />
        </label>
        <label className="block">
          <span className="block text-xs text-purple-900 mb-1">AUD/USD</span>
          <input
            type="number"
            step="0.0001"
            min="0.1"
            max="2"
            value={aud}
            onChange={(e) => setAud(e.target.value)}
            className="w-full px-3 py-2 min-h-[44px] border border-purple-300 rounded text-base bg-white"
          />
        </label>
      </div>
      <div className="flex gap-2">
        <button
          onClick={apply}
          className="px-4 py-2 min-h-[44px] bg-purple-600 hover:bg-purple-700 text-white rounded text-sm font-medium transition-colors"
        >
          Apply override
        </button>
        {currentOverride && (
          <button
            onClick={clear}
            className="px-4 py-2 min-h-[44px] bg-white border border-purple-300 text-purple-800 hover:bg-purple-100 rounded text-sm font-medium transition-colors"
          >
            Clear override
          </button>
        )}
      </div>
      {currentOverride && (
        <p className="text-xs text-purple-800 mt-2">
          ⚙ Override active: oil ${currentOverride.brent_usd.toFixed(2)}, AUD {currentOverride.aud_usd.toFixed(4)}
        </p>
      )}
    </div>
  );
}
