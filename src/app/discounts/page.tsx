"use client";

import { useEffect, useState } from "react";
import {
  Discount,
  DiscountType,
} from "@/lib/discounts";
import { loadDiscounts, saveDiscounts } from "@/lib/useDiscounts";
import { CANONICAL_BRANDS } from "@/lib/brands";
import type { StateCode } from "@/lib/types";

const ALL_STATE_CODES: StateCode[] = ["NSW", "VIC", "QLD", "SA", "WA", "NT", "TAS", "ACT"];

const TYPE_LABELS: Record<DiscountType, string> = {
  fixed_cpl: "c/L off",
  percent_cashback: "% cashback",
  fixed_rebate: "$ per fill",
};

const TYPE_UNITS: Record<DiscountType, string> = {
  fixed_cpl: "c/L",
  percent_cashback: "%",
  fixed_rebate: "$",
};

function newId(): string {
  return "d-" + Math.random().toString(36).slice(2, 9);
}

function describeBrands(brands: string[]): string {
  if (brands.length === 0) return "Any brand";
  if (brands.length <= 3) return brands.join(", ");
  return `${brands.slice(0, 2).join(", ")} + ${brands.length - 2} more`;
}

function describeStates(states: StateCode[]): string {
  if (states.length === 0) return "Any state";
  return states.join(", ");
}

export default function DiscountsPage() {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
    if (!window.confirm("Delete this discount?")) return;
    setDiscounts((prev) => prev.filter((d) => d.id !== id));
    if (expandedId === id) setExpandedId(null);
  }

  function addDiscount() {
    const id = newId();
    setDiscounts((prev) => [
      ...prev,
      {
        id,
        name: "New discount",
        type: "fixed_cpl",
        value: 4,
        appliesTo: "both",
        enabled: true,
        brands: [],
        states: [],
      },
    ]);
    setExpandedId(id);
  }

  function toggleBrand(d: Discount, brand: string) {
    const next = d.brands.includes(brand)
      ? d.brands.filter((b) => b !== brand)
      : [...d.brands, brand];
    updateDiscount(d.id, { brands: next });
  }

  function toggleState(d: Discount, state: StateCode) {
    const next = d.states.includes(state)
      ? d.states.filter((s) => s !== state)
      : [...d.states, state];
    updateDiscount(d.id, { states: next });
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
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-5 h-5"
          >
            <path
              fillRule="evenodd"
              d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
              clipRule="evenodd"
            />
          </svg>
        </a>
        <h1 className="font-bold text-lg">Your discounts</h1>
      </div>

      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-4">
        {/* Intro */}
        <section>
          <p className="text-sm text-gray-700 leading-relaxed">
            Enable the loyalty programs, auto-club memberships and cashback rules
            you actually use. Matching stations on the map will show the
            after-discount price. Leave brand or state empty to make a discount
            apply everywhere.
          </p>
        </section>

        {/* Discount list */}
        <section className="space-y-3" aria-label="Configured discounts">
          {discounts.length === 0 && hydrated && (
            <div className="bg-white rounded-xl p-5 border border-gray-200 text-sm text-gray-500 italic">
              No discounts yet. Add one below.
            </div>
          )}

          {discounts.map((d) => {
            const isExpanded = expandedId === d.id;
            return (
              <div
                key={d.id}
                className={`rounded-xl border bg-white shadow-sm ${
                  d.enabled ? "border-emerald-300" : "border-gray-200"
                }`}
              >
                {/* Header row: enabled + name + type + value + expand + delete */}
                <div className="flex items-center gap-2 p-3 flex-wrap">
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
                    className="flex-1 min-w-[140px] px-2 py-1.5 border border-gray-300 rounded text-sm bg-white font-medium"
                    aria-label="Discount name"
                  />
                  <select
                    value={d.type}
                    onChange={(e) =>
                      updateDiscount(d.id, { type: e.target.value as DiscountType })
                    }
                    className="px-2 py-1.5 border border-gray-300 rounded text-xs bg-white"
                    aria-label="Discount type"
                  >
                    <option value="fixed_cpl">{TYPE_LABELS.fixed_cpl}</option>
                    <option value="percent_cashback">{TYPE_LABELS.percent_cashback}</option>
                  </select>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={d.value}
                      onChange={(e) => updateDiscount(d.id, { value: Number(e.target.value) })}
                      step={d.type === "fixed_cpl" ? 0.1 : 0.1}
                      min={0}
                      className="w-16 px-2 py-1.5 border border-gray-300 rounded text-sm font-mono bg-white"
                      aria-label="Discount value"
                    />
                    <span className="text-xs text-gray-500">{TYPE_UNITS[d.type]}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteDiscount(d.id)}
                    className="text-red-600 hover:bg-red-50 active:bg-red-100 text-xs px-2 py-1 rounded transition-colors"
                    aria-label={`Delete ${d.name}`}
                  >
                    Delete
                  </button>
                </div>

                {/* Summary row — shows filter state at a glance */}
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : d.id)}
                  aria-expanded={isExpanded}
                  aria-controls={`filters-${d.id}`}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2 border-t border-gray-100 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="text-xs text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
                    {d.stationIds && d.stationIds.length > 0 ? (
                      <span>
                        <strong className="text-gray-700">Station-specific override</strong>{" "}
                        ({d.stationIds.length === 1 ? "1 station" : `${d.stationIds.length} stations`})
                      </span>
                    ) : (
                      <>
                        <span>
                          <strong className="text-gray-700">Brands:</strong>{" "}
                          {describeBrands(d.brands)}
                        </span>
                        <span>
                          <strong className="text-gray-700">States:</strong>{" "}
                          {describeStates(d.states)}
                        </span>
                      </>
                    )}
                  </div>
                  <span aria-hidden="true" className="text-gray-400 text-sm">
                    {isExpanded ? "▴" : "▾"}
                  </span>
                </button>

                {/* Expanded filters — hidden for station-specific overrides (brand/state don't apply) */}
                {isExpanded && !(d.stationIds && d.stationIds.length > 0) && (
                  <div
                    id={`filters-${d.id}`}
                    className="border-t border-gray-100 p-3 space-y-4"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold uppercase tracking-wide text-gray-700">
                          Brands
                        </label>
                        {d.brands.length > 0 && (
                          <button
                            type="button"
                            onClick={() => updateDiscount(d.id, { brands: [] })}
                            className="text-xs text-emerald-700 hover:text-emerald-800 underline"
                          >
                            Clear (any brand)
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-1">
                        {CANONICAL_BRANDS.map((brand) => (
                          <label
                            key={brand}
                            className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5"
                          >
                            <input
                              type="checkbox"
                              checked={d.brands.includes(brand)}
                              onChange={() => toggleBrand(d, brand)}
                              className="w-4 h-4 accent-emerald-600"
                            />
                            <span>{brand}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold uppercase tracking-wide text-gray-700">
                          States
                        </label>
                        {d.states.length > 0 && (
                          <button
                            type="button"
                            onClick={() => updateDiscount(d.id, { states: [] })}
                            className="text-xs text-emerald-700 hover:text-emerald-800 underline"
                          >
                            Clear (any state)
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {ALL_STATE_CODES.map((state) => {
                          const selected = d.states.includes(state);
                          return (
                            <button
                              key={state}
                              type="button"
                              onClick={() => toggleState(d, state)}
                              aria-pressed={selected}
                              className={`px-3 py-1.5 rounded-md border text-sm font-medium transition-colors ${
                                selected
                                  ? "bg-emerald-600 text-white border-emerald-600"
                                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                              }`}
                            >
                              {state}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </section>

        {/* Add */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={addDiscount}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            + Add discount
          </button>
        </div>

        {/* Footer caveat */}
        <p className="text-xs text-gray-500 italic pt-2 border-t border-gray-200">
          Discounts save to this browser only. They never leave your device. The
          brand and state filters match stations on the map — brand names use a
          canonical list that catches variants like &quot;Shell Coles Express&quot; →
          &quot;Coles Express&quot; automatically.
        </p>
      </div>
    </div>
  );
}
