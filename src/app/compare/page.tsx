"use client";

import { useEffect, useMemo, useState } from "react";
import { VehicleProfile } from "@/lib/types";
import { loadVehicles } from "@/lib/vehicles";
import { FUEL_TYPES } from "@/lib/fuel-codes";

interface CompareRow {
  vehicle: VehicleProfile;
  litresPerYear: number;
  costPerYear: number;
  costPerMonth: number;
  costPerKm: number;
  rank: number;
}

export default function ComparePage() {
  const [vehicles, setVehicles] = useState<VehicleProfile[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pricePerLitre, setPricePerLitre] = useState(220);
  const [annualKm, setAnnualKm] = useState(15000);

  useEffect(() => {
    const v = loadVehicles();
    setVehicles(v);
    // Default: compare all saved vehicles
    setSelectedIds(new Set(v.map((x) => x.id)));
  }, []);

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const rows: CompareRow[] = useMemo(() => {
    const selected = vehicles.filter((v) => selectedIds.has(v.id));
    const computed = selected.map((v) => {
      const litresPerYear = (annualKm / 100) * v.consumption;
      const costPerYear = litresPerYear * (pricePerLitre / 100);
      const costPerMonth = costPerYear / 12;
      const costPerKm = costPerYear / annualKm;
      return {
        vehicle: v,
        litresPerYear,
        costPerYear,
        costPerMonth,
        costPerKm,
        rank: 0,
      };
    });
    computed.sort((a, b) => a.costPerYear - b.costPerYear);
    computed.forEach((r, i) => (r.rank = i + 1));
    return computed;
  }, [vehicles, selectedIds, pricePerLitre, annualKm]);

  const cheapest = rows[0];
  const thirstiest = rows[rows.length - 1];
  const spread = cheapest && thirstiest ? thirstiest.costPerYear - cheapest.costPerYear : 0;

  function fuelName(code: string) {
    return FUEL_TYPES.find((f) => f.code === code)?.name ?? code;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Sticky header */}
      <div className="sticky top-0 z-30 bg-slate-800 text-white px-3 py-3 flex items-center gap-3 shadow-md">
        <a
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
        </a>
        <h1 className="font-bold text-lg">Which car should I drive?</h1>
      </div>

      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-5">
        <section>
          <p className="text-sm text-gray-700 leading-relaxed">
            Compare your saved vehicles side-by-side at a chosen fuel price and annual distance.
            This is a fuel-only cost view — it ignores depreciation, servicing and rego.
          </p>
        </section>

        {/* Empty state */}
        {vehicles.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
            <p className="text-sm text-gray-800 mb-3">
              No vehicles saved yet. Save a vehicle from the Trip Planner first.
            </p>
            <a
              href="/trip"
              className="inline-block px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Go to Trip Planner
            </a>
          </div>
        )}

        {vehicles.length === 1 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-gray-800">
            You only have one vehicle saved. Save a second in the Trip Planner to compare.
          </div>
        )}

        {vehicles.length > 0 && (
          <>
            {/* Inputs */}
            <section className="bg-white rounded-xl p-5 shadow-sm border border-gray-200 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fuel price:{" "}
                  <span className="font-mono text-emerald-600">{pricePerLitre}</span> c/L{" "}
                  <span className="text-gray-500">
                    (${(pricePerLitre / 100).toFixed(2)}/L)
                  </span>
                </label>
                <input
                  type="range"
                  min={100}
                  max={350}
                  step={1}
                  value={pricePerLitre}
                  onChange={(e) => setPricePerLitre(Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Annual distance:{" "}
                  <span className="font-mono text-emerald-600">{annualKm.toLocaleString()}</span>{" "}
                  km
                </label>
                <input
                  type="range"
                  min={2000}
                  max={60000}
                  step={500}
                  value={annualKm}
                  onChange={(e) => setAnnualKm(Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>
            </section>

            {/* Vehicle selector */}
            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-2">
                Vehicles to compare
              </h2>
              <div className="space-y-2">
                {vehicles.map((v) => (
                  <label
                    key={v.id}
                    className="flex items-center gap-3 bg-white rounded-lg px-3 py-2.5 border border-gray-200 cursor-pointer hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(v.id)}
                      onChange={() => toggle(v.id)}
                      className="w-5 h-5 accent-emerald-600"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-gray-900 truncate">{v.name}</div>
                      <div className="text-xs text-gray-500">
                        {fuelName(v.fuel)} · {v.consumption} L/100km · {v.tankSize}L tank
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </section>

            {/* Comparison cards */}
            {rows.length === 0 && (
              <div className="bg-white rounded-xl p-4 text-sm text-gray-600 border border-gray-200">
                Select at least one vehicle to compare.
              </div>
            )}

            {rows.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-base font-semibold text-gray-900">Annual fuel cost</h2>
                {rows.map((r) => {
                  const isCheapest = r.rank === 1 && rows.length > 1;
                  const extraOverCheapest = r.costPerYear - (cheapest?.costPerYear ?? 0);
                  return (
                    <div
                      key={r.vehicle.id}
                      className={`rounded-xl p-4 border-2 ${
                        isCheapest
                          ? "bg-emerald-50 border-emerald-500"
                          : "bg-white border-gray-200"
                      }`}
                    >
                      <div className="flex items-baseline justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                              isCheapest
                                ? "bg-emerald-600 text-white"
                                : "bg-gray-200 text-gray-700"
                            }`}
                          >
                            {r.rank}
                          </span>
                          <h3 className="font-semibold text-gray-900">{r.vehicle.name}</h3>
                        </div>
                        {isCheapest && (
                          <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                            cheapest
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">
                            Per year
                          </div>
                          <div className="font-mono text-lg font-bold text-gray-900">
                            ${r.costPerYear.toFixed(0)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">
                            Per month
                          </div>
                          <div className="font-mono text-base font-semibold text-gray-800">
                            ${r.costPerMonth.toFixed(0)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">
                            Per km
                          </div>
                          <div className="font-mono text-base font-semibold text-gray-800">
                            {(r.costPerKm * 100).toFixed(1)}¢
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">
                            L / year
                          </div>
                          <div className="font-mono text-base font-semibold text-gray-800">
                            {r.litresPerYear.toFixed(0)}
                          </div>
                        </div>
                      </div>
                      {!isCheapest && rows.length > 1 && (
                        <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-600">
                          +${extraOverCheapest.toFixed(0)}/yr more than{" "}
                          <span className="font-medium">{cheapest!.vehicle.name}</span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {rows.length > 1 && spread > 0 && (
                  <div className="bg-slate-800 text-white rounded-xl p-4 mt-4">
                    <div className="text-xs uppercase tracking-wide text-slate-300 mb-1">
                      Fuel-cost spread
                    </div>
                    <div className="font-mono text-2xl font-bold mb-1">
                      ${spread.toFixed(0)}/year
                    </div>
                    <div className="text-sm text-slate-200">
                      between <strong>{cheapest!.vehicle.name}</strong> and{" "}
                      <strong>{thirstiest!.vehicle.name}</strong> at these assumptions.
                    </div>
                    <div className="text-xs text-slate-300 mt-2 italic">
                      Over a 5-year ownership period: ~${(spread * 5).toFixed(0)}. That&apos;s a
                      rego, a service, or a decent holiday.
                    </div>
                  </div>
                )}
              </section>
            )}
          </>
        )}

        <section className="text-xs text-gray-500 space-y-1 pt-2">
          <p>
            <strong>What this ignores:</strong> depreciation, insurance, servicing, tyres, rego,
            finance, and the fact that fuel prices vary day-to-day. This is a fuel-only lens on
            the car-choice decision.
          </p>
          <p>
            <strong>Tip:</strong> the consumption figure matters most. Combined-cycle consumption
            on the sticker is optimistic — add 15–20% for real-world driving to match what
            you&apos;ll actually see.
          </p>
        </section>
      </div>
    </div>
  );
}
