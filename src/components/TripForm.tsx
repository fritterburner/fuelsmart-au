"use client";

import { useState, useEffect } from "react";
import { FuelCode, VehicleProfile } from "@/lib/types";
import { FUEL_TYPES, FUEL_FALLBACKS } from "@/lib/fuel-codes";
import { loadVehicles, saveVehicle, deleteVehicle } from "@/lib/vehicles";
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
  returnTrip: boolean;
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
    returnTrip: false,
  });

  // Store confirmed coordinates for each location
  const [originCoords, setOriginCoords] = useState<[number, number] | null>(null);
  const [destCoords, setDestCoords] = useState<[number, number] | null>(null);
  const [viaCoords, setViaCoords] = useState<([number, number] | null)[]>([]);

  const [error, setError] = useState("");

  // ─── Saved Vehicles ───────────────────────────────────────────────────────
  const [vehicles, setVehicles] = useState<VehicleProfile[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");

  useEffect(() => {
    setVehicles(loadVehicles());
  }, []);

  function handleSelectVehicle(id: string) {
    setSelectedVehicleId(id);
    if (!id) return; // "Custom" selected
    const v = vehicles.find((veh) => veh.id === id);
    if (v) {
      setForm((f) => ({
        ...f,
        fuel: v.fuel,
        tank: v.tankSize,
        consumption: v.consumption,
        jerry: v.jerryCapacity,
      }));
    }
  }

  function handleSaveVehicle() {
    const name = window.prompt("Vehicle name (e.g. Hilux, Camry):");
    if (!name?.trim()) return;
    const profile: VehicleProfile = {
      id: crypto.randomUUID(),
      name: name.trim(),
      fuel: form.fuel,
      tankSize: form.tank,
      consumption: form.consumption,
      jerryCapacity: form.jerry,
    };
    const updated = saveVehicle(profile);
    setVehicles(updated);
    setSelectedVehicleId(profile.id);
  }

  function handleDeleteVehicle() {
    if (!selectedVehicleId) return;
    const v = vehicles.find((veh) => veh.id === selectedVehicleId);
    if (!v) return;
    if (!window.confirm(`Delete "${v.name}"?`)) return;
    const updated = deleteVehicle(selectedVehicleId);
    setVehicles(updated);
    setSelectedVehicleId("");
  }

  // Clear vehicle selection when manually changing vehicle fields
  function setVehicleField(field: keyof TripFormData, value: any) {
    setSelectedVehicleId("");
    setForm((f) => ({ ...f, [field]: value }));
  }

  // ─── Google Maps Import ───────────────────────────────────────────────────
  const [gmapsUrl, setGmapsUrl] = useState("");
  const [gmapsLoading, setGmapsLoading] = useState(false);
  const [gmapsError, setGmapsError] = useState("");

  async function handleGmapsImport() {
    const url = gmapsUrl.trim();
    if (!url) return;
    setGmapsLoading(true);
    setGmapsError("");
    try {
      const resp = await fetch(`/api/parse-gmaps?url=${encodeURIComponent(url)}`);
      const data = await resp.json();
      if (!resp.ok) {
        setGmapsError(data.error || "Failed to parse URL");
        setGmapsLoading(false);
        return;
      }
      const wps: { label: string; lat?: number; lng?: number }[] = data.waypoints;
      if (wps.length < 2) {
        setGmapsError("Need at least an origin and destination");
        setGmapsLoading(false);
        return;
      }
      // First = origin, last = destination, middle = via points
      const origin = wps[0];
      const dest = wps[wps.length - 1];
      const vias = wps.slice(1, -1);

      setForm((f) => ({
        ...f,
        originQuery: origin.label,
        destQuery: dest.label,
        viaQueries: vias.map((v) => v.label),
      }));

      if (origin.lat !== undefined && origin.lng !== undefined) {
        setOriginCoords([origin.lat, origin.lng]);
      } else {
        setOriginCoords(null);
      }
      if (dest.lat !== undefined && dest.lng !== undefined) {
        setDestCoords([dest.lat, dest.lng]);
      } else {
        setDestCoords(null);
      }
      setViaCoords(
        vias.map((v) =>
          v.lat !== undefined && v.lng !== undefined ? [v.lat, v.lng] as [number, number] : null
        )
      );
      setGmapsUrl("");
    } catch {
      setGmapsError("Failed to import route");
    }
    setGmapsLoading(false);
  }

  // ─── Reverse Direction ─────────────────────────────────────────────────────
  function handleReverseRoute() {
    setForm((f) => ({
      ...f,
      originQuery: f.destQuery,
      destQuery: f.originQuery,
      viaQueries: [...f.viaQueries].reverse(),
    }));
    const tmpCoords = originCoords;
    setOriginCoords(destCoords);
    setDestCoords(tmpCoords);
    setViaCoords((v) => [...v].reverse());
  }

  // ─── Submit ───────────────────────────────────────────────────────────────
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
    if (form.viaQueries.length >= 10) return;
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
      {/* Google Maps Import — collapsible */}
      <details className="group">
        <summary className="text-sm font-medium text-emerald-700 cursor-pointer hover:text-emerald-800 select-none">
          Import from Google Maps
        </summary>
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={gmapsUrl}
            onChange={(e) => setGmapsUrl(e.target.value)}
            placeholder="Paste a Google Maps URL..."
            className="flex-1 px-3 py-2.5 min-h-[44px] border rounded-lg text-sm"
          />
          <button
            type="button"
            onClick={handleGmapsImport}
            disabled={gmapsLoading || !gmapsUrl.trim()}
            className="px-4 py-2.5 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {gmapsLoading ? "Importing..." : "Import"}
          </button>
        </div>
        {gmapsError && <p className="text-red-600 text-xs mt-1">{gmapsError}</p>}
      </details>

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

      {/* Route action buttons */}
      <div className="flex items-center gap-3 flex-wrap">
        {form.viaQueries.length < 10 && (
          <button
            type="button"
            onClick={addVia}
            className="text-sm font-medium text-emerald-700 hover:text-emerald-800 active:text-emerald-900 transition-colors px-1 py-1"
          >
            &#xFF0B; Add stop
          </button>
        )}
        {(originCoords || destCoords) && (
          <button
            type="button"
            onClick={handleReverseRoute}
            className="text-sm font-medium text-slate-600 hover:text-slate-800 active:text-slate-900 transition-colors px-1 py-1 flex items-center gap-1"
            title="Reverse the route direction"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M2.24 6.8a.75.75 0 001.06-.04l1.95-2.1v8.59a.75.75 0 001.5 0V4.66l1.95 2.1a.75.75 0 101.1-1.02l-3.25-3.5a.75.75 0 00-1.1 0L2.2 5.74a.75.75 0 00.04 1.06zm8 6.4a.75.75 0 00-.04 1.06l3.25 3.5a.75.75 0 001.1 0l3.25-3.5a.75.75 0 10-1.1-1.02l-1.95 2.1V6.75a.75.75 0 00-1.5 0v8.59l-1.95-2.1a.75.75 0 00-1.06-.04z" clipRule="evenodd" />
            </svg>
            Reverse direction
          </button>
        )}
      </div>

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

      {/* Return trip toggle */}
      <label className="flex items-center gap-3 cursor-pointer">
        <div className="relative">
          <input
            type="checkbox"
            checked={form.returnTrip}
            onChange={(e) => set("returnTrip", e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-300 rounded-full peer-checked:bg-emerald-500 transition-colors" />
          <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform" />
        </div>
        <span className="text-sm text-gray-700">
          Return trip{form.returnTrip && originCoords && destCoords ? (
            <span className="text-gray-400 ml-1">
              (route back {form.viaQueries.length > 0 ? "via same stops" : "included"})
            </span>
          ) : null}
        </span>
      </label>

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

      {/* Vehicle profile selector + settings */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <label className="text-sm font-medium text-gray-700">Vehicle</label>
          <select
            value={selectedVehicleId}
            onChange={(e) => handleSelectVehicle(e.target.value)}
            className="flex-1 px-2 py-1.5 min-h-[36px] border rounded-lg text-sm bg-white"
          >
            <option value="">Custom</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.tankSize}L, {v.consumption}L/100km)
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleSaveVehicle}
            className="px-2.5 py-1.5 min-h-[36px] text-xs font-medium text-emerald-700 border border-emerald-300 rounded-lg hover:bg-emerald-50 active:bg-emerald-100 transition-colors whitespace-nowrap"
          >
            Save
          </button>
          {selectedVehicleId && (
            <button
              type="button"
              onClick={handleDeleteVehicle}
              className="px-2.5 py-1.5 min-h-[36px] text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 active:bg-red-100 transition-colors"
            >
              Delete
            </button>
          )}
        </div>

        {/* Vehicle settings — 2x2 on mobile, 4-col on md+ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fuel Type</label>
            <select
              value={form.fuel}
              onChange={(e) => setVehicleField("fuel", e.target.value)}
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
              onChange={(e) => setVehicleField("tank", Number(e.target.value))}
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
              onChange={(e) => setVehicleField("consumption", Number(e.target.value))}
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
              onChange={(e) => setVehicleField("jerry", Number(e.target.value))}
              className="w-full px-3 py-2.5 min-h-[44px] border rounded-lg text-base"
              min={0}
              max={200}
            />
          </div>
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
