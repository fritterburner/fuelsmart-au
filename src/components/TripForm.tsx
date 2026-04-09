"use client";

import { useState } from "react";
import { FuelCode } from "@/lib/types";
import { FUEL_TYPES, FUEL_FALLBACKS } from "@/lib/fuel-codes";
import LocationInput from "./LocationInput";

interface TripFormData {
  originQuery: string;
  destQuery: string;
  viaQueries: string[];
  fuel: FuelCode;
  tank: number;
  consumption: number;
  jerry: number;
  startingFuelPct: number;
  allowFallback: boolean;
  arriveFull: boolean;
  reservePct: number;
}

interface Props {
  onSubmit: (data: TripFormData & {
    originCoords: [number, number];
    destCoords: [number, number];
    viaCoords: [number, number][];
  }) => void;
  loading: boolean;
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
    allowFallback: true,
    arriveFull: false,
    reservePct: 10,
  });

  // Store confirmed coordinates for each location
  const [originCoords, setOriginCoords] = useState<[number, number] | null>(null);
  const [destCoords, setDestCoords] = useState<[number, number] | null>(null);
  const [viaCoords, setViaCoords] = useState<([number, number] | null)[]>([]);

  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!originCoords) {
      setError("Please select an origin from the search results");
      return;
    }
    if (!destCoords) {
      setError("Please select a destination from the search results");
      return;
    }

    const confirmedVia: [number, number][] = [];
    for (let i = 0; i < viaCoords.length; i++) {
      if (!viaCoords[i]) {
        setError(`Please select via point ${i + 1} from the search results`);
        return;
      }
      confirmedVia.push(viaCoords[i]!);
    }

    onSubmit({ ...form, originCoords, destCoords, viaCoords: confirmedVia });
  }

  const set = (field: keyof TripFormData, value: any) =>
    setForm((f) => ({ ...f, [field]: value }));

  const addVia = () => {
    if (form.viaQueries.length >= 5) return;
    setForm((f) => ({ ...f, viaQueries: [...f.viaQueries, ""] }));
    setViaCoords((v) => [...v, null]);
  };

  const removeVia = (index: number) => {
    setForm((f) => ({
      ...f,
      viaQueries: f.viaQueries.filter((_, i) => i !== index),
    }));
    setViaCoords((v) => v.filter((_, i) => i !== index));
  };

  const setViaQuery = (index: number, value: string) => {
    setForm((f) => ({
      ...f,
      viaQueries: f.viaQueries.map((q, i) => (i === index ? value : q)),
    }));
    // Clear confirmed coords when user edits text
    setViaCoords((v) => v.map((c, i) => (i === index ? null : c)));
  };

  const startingLitres = Math.round(form.startingFuelPct / 100 * form.tank);

  return (
    <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4">
      {/* Origin */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Origin</label>
        <LocationInput
          value={form.originQuery}
          onChange={(v) => {
            set("originQuery", v);
            setOriginCoords(null); // clear coords when user types
          }}
          onSelect={(lat, lng, label) => {
            set("originQuery", label);
            setOriginCoords([lat, lng]);
          }}
          placeholder="e.g. Darwin"
          required
          confirmed={!!originCoords}
        />
      </div>

      {/* Via points */}
      {form.viaQueries.map((q, i) => (
        <div key={i} className="flex items-end gap-2">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Via {i + 1}
            </label>
            <LocationInput
              value={q}
              onChange={(v) => setViaQuery(i, v)}
              onSelect={(lat, lng, label) => {
                setForm((f) => ({
                  ...f,
                  viaQueries: f.viaQueries.map((qq, ii) => (ii === i ? label : qq)),
                }));
                setViaCoords((v) => v.map((c, ii) => (ii === i ? [lat, lng] as [number, number] : c)));
              }}
              placeholder="e.g. Katherine"
              required
              confirmed={!!viaCoords[i]}
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
        <LocationInput
          value={form.destQuery}
          onChange={(v) => {
            set("destQuery", v);
            setDestCoords(null);
          }}
          onSelect={(lat, lng, label) => {
            set("destQuery", label);
            setDestCoords([lat, lng]);
          }}
          placeholder="e.g. Cairns"
          required
          confirmed={!!destCoords}
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

      {/* LAF fallback toggle — only show when fuel has defined fallbacks */}
      {FUEL_FALLBACKS[form.fuel] && (
        <label className="flex items-center gap-3 cursor-pointer">
          <div className="relative">
            <input
              type="checkbox"
              checked={form.allowFallback}
              onChange={(e) => set("allowFallback", e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-300 rounded-full peer-checked:bg-emerald-500 transition-colors" />
            <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform" />
          </div>
          <span className="text-sm text-gray-700">
            Use Low Aromatic / OPAL fuel where {FUEL_TYPES.find(f => f.code === form.fuel)?.name || form.fuel} unavailable
          </span>
        </label>
      )}

      {/* Arrive with full tank toggle */}
      <label className="flex items-center gap-3 cursor-pointer">
        <div className="relative">
          <input
            type="checkbox"
            checked={form.arriveFull}
            onChange={(e) => set("arriveFull", e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-300 rounded-full peer-checked:bg-emerald-500 transition-colors" />
          <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform" />
        </div>
        <span className="text-sm text-gray-700">
          Arrive with full tank (stock up at cheapest stops)
        </span>
      </label>

      {/* Fuel reserve threshold slider */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Minimum Fuel Reserve
        </label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={30}
            step={5}
            value={form.reservePct}
            onChange={(e) => set("reservePct", Number(e.target.value))}
            className="flex-1 min-h-[44px] accent-emerald-600"
          />
          <span className="text-sm font-medium text-gray-700 whitespace-nowrap min-w-[110px] text-right">
            {form.reservePct}% ({Math.round(form.reservePct / 100 * form.tank)}L of {form.tank}L)
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">
          Never arrive at a stop with less than this in the tank
        </p>
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
