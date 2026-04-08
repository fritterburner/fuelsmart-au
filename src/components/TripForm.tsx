"use client";

import { useState } from "react";
import { FuelCode } from "@/lib/types";
import { FUEL_TYPES } from "@/lib/fuel-codes";

interface TripFormData {
  originQuery: string;
  destQuery: string;
  viaQueries: string[];
  fuel: FuelCode;
  tank: number;
  consumption: number;
  jerry: number;
  startingFuelPct: number;
}

interface Props {
  onSubmit: (data: TripFormData & {
    originCoords: [number, number];
    destCoords: [number, number];
    viaCoords: [number, number][];
  }) => void;
  loading: boolean;
}

async function geocode(query: string): Promise<[number, number] | null> {
  const resp = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
  const data = await resp.json();
  if (data.length === 0) return null;
  return [Number(data[0].lat), Number(data[0].lon)];
}

export default function TripForm({ onSubmit, loading }: Props) {
  const [form, setForm] = useState<TripFormData>({
    originQuery: "",
    destQuery: "",
    viaQueries: [],
    fuel: "U91",
    tank: 45,
    consumption: 10.5,
    jerry: 0,
    startingFuelPct: 100,
  });
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const geocodePromises = [
      geocode(form.originQuery),
      geocode(form.destQuery),
      ...form.viaQueries.map((q) => geocode(q)),
    ];

    const results = await Promise.all(geocodePromises);

    const originCoords = results[0];
    const destCoords = results[1];
    const viaResults = results.slice(2);

    if (!originCoords) { setError("Could not find origin location"); return; }
    if (!destCoords) { setError("Could not find destination location"); return; }

    const viaCoords: [number, number][] = [];
    for (let i = 0; i < viaResults.length; i++) {
      if (!viaResults[i]) {
        setError(`Could not find via point ${i + 1}`);
        return;
      }
      viaCoords.push(viaResults[i]!);
    }

    onSubmit({ ...form, originCoords, destCoords, viaCoords });
  }

  const set = (field: keyof TripFormData, value: any) =>
    setForm((f) => ({ ...f, [field]: value }));

  const addVia = () => {
    if (form.viaQueries.length >= 5) return;
    setForm((f) => ({ ...f, viaQueries: [...f.viaQueries, ""] }));
  };

  const removeVia = (index: number) => {
    setForm((f) => ({
      ...f,
      viaQueries: f.viaQueries.filter((_, i) => i !== index),
    }));
  };

  const setVia = (index: number, value: string) => {
    setForm((f) => ({
      ...f,
      viaQueries: f.viaQueries.map((q, i) => (i === index ? value : q)),
    }));
  };

  const startingLitres = Math.round(form.startingFuelPct / 100 * form.tank);

  return (
    <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4">
      {/* Origin */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Origin</label>
        <input
          type="text"
          value={form.originQuery}
          onChange={(e) => set("originQuery", e.target.value)}
          placeholder="e.g. Darwin"
          className="w-full px-3 py-2.5 min-h-[44px] border rounded-lg text-base"
          required
        />
      </div>

      {/* Via points */}
      {form.viaQueries.map((q, i) => (
        <div key={i} className="flex items-end gap-2">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Via {i + 1}
            </label>
            <input
              type="text"
              value={q}
              onChange={(e) => setVia(i, e.target.value)}
              placeholder="e.g. Katherine"
              className="w-full px-3 py-2.5 min-h-[44px] border rounded-lg text-base"
              required
            />
          </div>
          <button
            type="button"
            onClick={() => removeVia(i)}
            className="flex items-center justify-center min-w-[44px] min-h-[44px] w-10 h-10 rounded-full border border-gray-300 text-gray-500 hover:bg-red-50 hover:text-red-600 hover:border-red-300 active:bg-red-100 transition-colors text-lg leading-none"
            aria-label={`Remove via point ${i + 1}`}
          >
            &#x2715;
          </button>
        </div>
      ))}

      {form.viaQueries.length < 5 && (
        <button
          type="button"
          onClick={addVia}
          className="text-sm font-medium text-emerald-700 hover:text-emerald-800 active:text-emerald-900 transition-colors px-1 py-1"
        >
          &#xFF0B; Add stop
        </button>
      )}

      {/* Destination */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Destination</label>
        <input
          type="text"
          value={form.destQuery}
          onChange={(e) => set("destQuery", e.target.value)}
          placeholder="e.g. Cairns"
          className="w-full px-3 py-2.5 min-h-[44px] border rounded-lg text-base"
          required
        />
      </div>

      {/* Starting Fuel Level slider */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Starting Fuel Level
        </label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={form.startingFuelPct}
            onChange={(e) => set("startingFuelPct", Number(e.target.value))}
            className="flex-1 min-h-[44px] accent-emerald-600"
          />
          <span className="text-sm font-medium text-gray-700 whitespace-nowrap min-w-[110px] text-right">
            {form.startingFuelPct}% ({startingLitres}L of {form.tank}L)
          </span>
        </div>
      </div>

      {/* Vehicle settings — 2x2 on mobile, 4-col on md+ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fuel Type</label>
          <select
            value={form.fuel}
            onChange={(e) => set("fuel", e.target.value)}
            className="w-full px-3 py-2.5 min-h-[44px] border rounded-lg text-base bg-white"
          >
            {FUEL_TYPES.map((f) => <option key={f.code} value={f.code}>{f.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tank (L)</label>
          <input
            type="number"
            value={form.tank}
            onChange={(e) => set("tank", Number(e.target.value))}
            className="w-full px-3 py-2.5 min-h-[44px] border rounded-lg text-base"
            min={10}
            max={200}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">L/100km</label>
          <input
            type="number"
            value={form.consumption}
            onChange={(e) => set("consumption", Number(e.target.value))}
            step={0.1}
            className="w-full px-3 py-2.5 min-h-[44px] border rounded-lg text-base"
            min={3}
            max={30}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Jerry Cans (L)</label>
          <input
            type="number"
            value={form.jerry}
            onChange={(e) => set("jerry", Number(e.target.value))}
            className="w-full px-3 py-2.5 min-h-[44px] border rounded-lg text-base"
            min={0}
            max={200}
          />
        </div>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3.5 md:py-3 min-h-[48px] bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-lg disabled:opacity-50 text-base transition-colors"
      >
        {loading ? "Planning..." : "Plan My Trip"}
      </button>
    </form>
  );
}
