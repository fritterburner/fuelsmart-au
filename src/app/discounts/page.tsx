"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Discount,
  DiscountType,
  AppliesTo,
  evaluate,
  breakevenDetourKm,
} from "@/lib/discounts";
import { loadDiscounts, saveDiscounts } from "@/lib/useDiscounts";

function newId() {
  return "d-" + Math.random().toString(36).slice(2, 9);
}

export default function DiscountsPage() {
  // Station quotes
  const [nameA, setNameA] = useState("My local");
  const [priceA, setPriceA] = useState(220);
  const [nameB, setNameB] = useState("Cheaper across town");
  const [priceB, setPriceB] = useState(210);
  const [detourKm, setDetourKm] = useState(5);
  const [fillLitres, setFillLitres] = useState(50);
  const [consumption, setConsumption] = useState(10);

  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setDiscounts(loadDiscounts());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveDiscounts(discounts);
  }, [discounts, hydrated]);

  function updateDiscount(id: string, patch: Partial<Discount>) {
    setDiscounts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  function deleteDiscount(id: string) {
    setDiscounts((prev) => prev.filter((d) => d.id !== id));
  }

  function addDiscount() {
    setDiscounts((prev) => [
      ...prev,
      {
        id: newId(),
        name: "New discount",
        type: "fixed_cpl",
        value: 4,
        appliesTo: "both",
        enabled: true,
        brands: [],
        states: [],
      },
    ]);
  }

  const results = useMemo(() => {
    return evaluate({
      quotes: [
        { label: "A", name: nameA, pricePerLitre: priceA, detourKm: 0 },
        { label: "B", name: nameB, pricePerLitre: priceB, detourKm },
      ],
      discounts,
      fillLitres,
      consumption,
    });
  }, [nameA, priceA, nameB, priceB, detourKm, fillLitres, consumption, discounts]);

  const [resA, resB] = results;
  const winner = resA.totalCost <= resB.totalCost ? resA : resB;
  const loser = winner === resA ? resB : resA;
  const saving = loser.totalCost - winner.totalCost;

  // Breakeven detour for the straight c/L saving at A vs B (at pump, no discounts)
  const rawSavingCpl = Math.max(0, priceA - priceB);
  const beKm = breakevenDetourKm(rawSavingCpl, fillLitres, consumption, priceA);

  const typeLabels: Record<DiscountType, string> = {
    fixed_cpl: "c/L off",
    percent_cashback: "% cashback",
    fixed_rebate: "$ per fill",
  };
  const typeUnits: Record<DiscountType, string> = {
    fixed_cpl: "c/L",
    percent_cashback: "%",
    fixed_rebate: "$",
  };

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
        <h1 className="font-bold text-lg">Cashback vs detour calculator</h1>
      </div>

      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-5">
        <section>
          <p className="text-sm text-gray-700 leading-relaxed">
            Is that 4c/L shopper docket actually saving you money if the cheaper station is 5km
            further away? Work out your real per-fill cost after discounts and detour fuel.
          </p>
        </section>

        {/* Station inputs */}
        <section className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
          <h2 className="text-base font-semibold text-gray-900 mb-3">Compare two stations</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-emerald-700">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-600 text-white text-xs">
                  A
                </span>
                Nearest station
              </div>
              <input
                type="text"
                value={nameA}
                onChange={(e) => setNameA(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="Station name"
              />
              <div>
                <label className="block text-xs text-gray-600 mb-0.5">Pump price (c/L)</label>
                <input
                  type="number"
                  value={priceA}
                  onChange={(e) => setPriceA(Number(e.target.value))}
                  min={50}
                  max={500}
                  step={0.1}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-blue-700">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-xs">
                  B
                </span>
                Alternative station
              </div>
              <input
                type="text"
                value={nameB}
                onChange={(e) => setNameB(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="Station name"
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-600 mb-0.5">Pump price (c/L)</label>
                  <input
                    type="number"
                    value={priceB}
                    onChange={(e) => setPriceB(Number(e.target.value))}
                    min={50}
                    max={500}
                    step={0.1}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-0.5">Extra km (round trip)</label>
                  <input
                    type="number"
                    value={detourKm}
                    onChange={(e) => setDetourKm(Number(e.target.value))}
                    min={0}
                    max={200}
                    step={0.5}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-100">
            <div>
              <label className="block text-xs text-gray-600 mb-0.5">Fill size (litres)</label>
              <input
                type="number"
                value={fillLitres}
                onChange={(e) => setFillLitres(Number(e.target.value))}
                min={1}
                max={500}
                step={1}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-0.5">Consumption (L/100km)</label>
              <input
                type="number"
                value={consumption}
                onChange={(e) => setConsumption(Number(e.target.value))}
                min={2}
                max={30}
                step={0.1}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
              />
            </div>
          </div>
        </section>

        {/* Discount programs */}
        <section className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-900">Your discount programs</h2>
            <button
              onClick={addDiscount}
              className="text-sm px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
            >
              + Add
            </button>
          </div>
          {discounts.length === 0 && (
            <p className="text-sm text-gray-500 italic">
              No discount programs. Add one to see how it changes the result.
            </p>
          )}
          <div className="space-y-2">
            {discounts.map((d) => (
              <div
                key={d.id}
                className={`rounded-lg border p-3 space-y-2 ${
                  d.enabled ? "bg-emerald-50/40 border-emerald-300" : "bg-gray-50 border-gray-200"
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={d.enabled}
                    onChange={(e) => updateDiscount(d.id, { enabled: e.target.checked })}
                    className="w-5 h-5 accent-emerald-600 flex-shrink-0"
                    aria-label={`Enable ${d.name}`}
                  />
                  <input
                    type="text"
                    value={d.name}
                    onChange={(e) => updateDiscount(d.id, { name: e.target.value })}
                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm bg-white"
                  />
                  <button
                    onClick={() => deleteDiscount(d.id)}
                    className="text-red-600 hover:text-red-800 text-xs px-2 py-1"
                    aria-label={`Delete ${d.name}`}
                  >
                    ✕
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={d.type}
                    onChange={(e) =>
                      updateDiscount(d.id, { type: e.target.value as DiscountType })
                    }
                    className="px-2 py-1.5 border border-gray-300 rounded text-xs bg-white"
                  >
                    <option value="fixed_cpl">{typeLabels.fixed_cpl}</option>
                    <option value="percent_cashback">{typeLabels.percent_cashback}</option>
                    <option value="fixed_rebate">{typeLabels.fixed_rebate}</option>
                  </select>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={d.value}
                      onChange={(e) => updateDiscount(d.id, { value: Number(e.target.value) })}
                      step={d.type === "fixed_cpl" ? 0.1 : d.type === "percent_cashback" ? 0.1 : 0.5}
                      min={0}
                      className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm font-mono bg-white"
                    />
                    <span className="text-xs text-gray-500">{typeUnits[d.type]}</span>
                  </div>
                  <select
                    value={d.appliesTo}
                    onChange={(e) =>
                      updateDiscount(d.id, { appliesTo: e.target.value as AppliesTo })
                    }
                    className="px-2 py-1.5 border border-gray-300 rounded text-xs bg-white"
                  >
                    <option value="both">Applies to both</option>
                    <option value="A">Only at A</option>
                    <option value="B">Only at B</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 italic mt-3">
            Tip: Shopper dockets typically work at one brand (Shell/Coles or Woolworths/Caltex) —
            set them to &ldquo;Only at A&rdquo; or &ldquo;Only at B&rdquo; as needed. Card cashback
            usually applies everywhere.
          </p>
        </section>

        {/* Results */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-gray-900">Verdict</h2>
          {results.map((r) => {
            const isWin = r === winner && saving > 0.01;
            return (
              <div
                key={r.label}
                className={`rounded-xl p-4 border-2 ${
                  isWin ? "bg-emerald-50 border-emerald-500" : "bg-white border-gray-200"
                }`}
              >
                <div className="flex items-baseline justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white ${
                        r.label === "A" ? "bg-emerald-600" : "bg-blue-600"
                      }`}
                    >
                      {r.label}
                    </span>
                    <h3 className="font-semibold text-gray-900">{r.name}</h3>
                  </div>
                  {isWin && (
                    <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                      cheaper
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">
                      Pump price
                    </div>
                    <div className="font-mono text-sm text-gray-700">
                      {r.pumpPricePerLitre.toFixed(1)}¢
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">
                      Effective
                    </div>
                    <div className="font-mono text-base font-semibold text-emerald-700">
                      {r.effectivePricePerLitre.toFixed(1)}¢
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">
                      Fill cost
                    </div>
                    <div className="font-mono text-base font-semibold text-gray-900">
                      ${r.fillCost.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">
                      Total (incl. detour)
                    </div>
                    <div className="font-mono text-lg font-bold text-gray-900">
                      ${r.totalCost.toFixed(2)}
                    </div>
                  </div>
                </div>

                {r.appliedDiscounts.length > 0 && (
                  <div className="pt-2 border-t border-gray-100">
                    <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">
                      Discounts applied
                    </div>
                    <ul className="text-xs text-gray-700 space-y-0.5">
                      {r.appliedDiscounts.map((a, i) => (
                        <li key={a.id + i} className="flex justify-between">
                          <span>{a.name}</span>
                          <span className="font-mono text-emerald-700">
                            −{a.valueCpl.toFixed(2)}¢/L
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {r.detourFuelCost > 0 && (
                  <div className="pt-2 border-t border-gray-100 text-xs text-gray-600 flex justify-between">
                    <span>Detour fuel burned</span>
                    <span className="font-mono text-amber-700">
                      +${r.detourFuelCost.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            );
          })}

          {/* Headline verdict */}
          {saving > 0.01 ? (
            <div className="bg-slate-800 text-white rounded-xl p-4">
              <div className="text-xs uppercase tracking-wide text-slate-300 mb-1">
                Winner: Station {winner.label}
              </div>
              <div className="font-mono text-2xl font-bold mb-1">
                ${saving.toFixed(2)} cheaper
              </div>
              <div className="text-sm text-slate-200">
                {winner.name} beats {loser.name} by ${saving.toFixed(2)} on this fill after all
                discounts &amp; detour fuel.
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-4">
              <div className="text-sm text-gray-800">
                <strong>Line ball.</strong> Within a few cents — not worth optimising further.
              </div>
            </div>
          )}
        </section>

        {/* Breakeven lens */}
        {rawSavingCpl > 0 && (
          <section className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
            <h2 className="text-base font-semibold text-gray-900 mb-2">
              Detour breakeven (pump-price only, ignoring discounts)
            </h2>
            <p className="text-sm text-gray-700 mb-2">
              At a {rawSavingCpl.toFixed(1)}¢/L price gap on a {fillLitres}L fill, the detour is
              worth driving up to{" "}
              <span className="font-mono font-bold text-emerald-700">
                {beKm.toFixed(1)} km
              </span>{" "}
              round-trip. Beyond that, you&apos;re burning more in detour fuel than you save at the
              pump.
            </p>
            <p className="text-xs text-gray-500 italic">
              Your current detour is {detourKm}km — {detourKm <= beKm ? "within" : "beyond"} the
              breakeven.
            </p>
          </section>
        )}

        {/* How it works */}
        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-2">How it works</h2>
          <ul className="text-sm text-gray-700 space-y-1 list-disc pl-5">
            <li>
              <strong>Fixed c/L discounts</strong> (shopper dockets, member rates) come off the
              pump price first.
            </li>
            <li>
              <strong>% cashback</strong> applies to the price after c/L discounts — so the more
              you take off first, the smaller the cashback dollars.
            </li>
            <li>
              <strong>Fixed $ rebate per fill</strong> is amortised over the litres in that fill —
              $5 back on 50L = 10¢/L equivalent.
            </li>
            <li>
              <strong>Detour fuel</strong> is priced at the pump rate of the station you&apos;re
              driving to (replacement cost).
            </li>
          </ul>
        </section>

        <p className="text-xs text-gray-500 italic pt-2 border-t border-gray-200">
          Discounts save to this browser only. They never leave your device.
        </p>
      </div>
    </div>
  );
}
