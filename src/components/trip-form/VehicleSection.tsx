"use client";

import { useState } from "react";
import type { FuelCode, VehicleProfile } from "@/lib/types";
import { FUEL_TYPES } from "@/lib/fuel-codes";

const DEFAULT_JERRY_LITRES = 20;

interface Props {
  fuel: FuelCode;
  tank: number;
  consumption: number;
  jerry: number;
  hasJerryCans: boolean;
  onFuelChange: (v: FuelCode) => void;
  onTankChange: (v: number) => void;
  onConsumptionChange: (v: number) => void;
  onJerryChange: (v: number) => void;
  onJerryToggle: (v: boolean) => void;

  vehicles: VehicleProfile[];
  selectedVehicleId: string;
  onSelectVehicle: (id: string) => void;
  onSaveVehicle: (name: string) => void;
  onDeleteVehicle: () => void;
}

export default function VehicleSection({
  fuel,
  tank,
  consumption,
  jerry,
  hasJerryCans,
  onFuelChange,
  onTankChange,
  onConsumptionChange,
  onJerryChange,
  onJerryToggle,
  vehicles,
  selectedVehicleId,
  onSelectVehicle,
  onSaveVehicle,
  onDeleteVehicle,
}: Props) {
  // Inline UX replaces window.prompt for "Save vehicle name" and
  // window.confirm for "Delete vehicle".
  const [naming, setNaming] = useState(false);
  const [pendingName, setPendingName] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function handleSaveSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = pendingName.trim();
    if (!name) return;
    onSaveVehicle(name);
    setNaming(false);
    setPendingName("");
  }

  function handleDeleteClick() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    onDeleteVehicle();
    setConfirmingDelete(false);
  }

  const selectedVehicleName =
    vehicles.find((v) => v.id === selectedVehicleId)?.name ?? "";

  return (
    <div>
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <label className="text-sm font-medium text-gray-700">Vehicle</label>
        <select
          value={selectedVehicleId}
          onChange={(e) => onSelectVehicle(e.target.value)}
          className="flex-1 min-w-[140px] px-2 py-1.5 min-h-[36px] border rounded-lg text-sm bg-white"
        >
          <option value="">Custom</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name} ({v.tankSize}L, {v.consumption}L/100km)
            </option>
          ))}
        </select>
        {!naming && (
          <button
            type="button"
            onClick={() => {
              setNaming(true);
              setPendingName("");
            }}
            className="px-2.5 py-1.5 min-h-[36px] text-xs font-medium text-emerald-700 border border-emerald-300 rounded-lg hover:bg-emerald-50 active:bg-emerald-100 transition-colors whitespace-nowrap"
          >
            Remember on this device
          </button>
        )}
        {selectedVehicleId && !naming && !confirmingDelete && (
          <button
            type="button"
            onClick={handleDeleteClick}
            className="px-2.5 py-1.5 min-h-[36px] text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 active:bg-red-100 transition-colors"
          >
            Delete
          </button>
        )}
        {confirmingDelete && (
          <span className="inline-flex items-center gap-1 text-xs">
            <span className="text-gray-700">
              Delete &quot;{selectedVehicleName}&quot;?
            </span>
            <button
              type="button"
              onClick={handleDeleteClick}
              className="px-2.5 py-1.5 min-h-[36px] font-medium text-white bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-lg transition-colors"
            >
              Yes, delete
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="px-2.5 py-1.5 min-h-[36px] font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </span>
        )}
      </div>

      {naming ? (
        <form onSubmit={handleSaveSubmit} className="flex items-center gap-2 mb-2">
          <input
            type="text"
            value={pendingName}
            onChange={(e) => setPendingName(e.target.value)}
            placeholder="e.g. Hilux, Camry"
            autoFocus
            className="flex-1 px-3 py-2 min-h-[40px] border rounded-lg text-sm"
            aria-label="Vehicle name"
          />
          <button
            type="submit"
            disabled={!pendingName.trim()}
            className="px-3 py-2 min-h-[40px] text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-lg disabled:opacity-50 transition-colors"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setNaming(false);
              setPendingName("");
            }}
            className="px-3 py-2 min-h-[40px] text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </form>
      ) : (
        <p className="text-xs text-gray-500 mb-2">
          Saved to your browser — not synced across devices.
        </p>
      )}

      {/* Vehicle settings — 2x2 on mobile, 3-col on md+ (jerry cans below) */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fuel Type</label>
          <select
            value={fuel}
            onChange={(e) => onFuelChange(e.target.value as FuelCode)}
            className="w-full px-3 py-2.5 min-h-[44px] border rounded-lg text-base bg-white"
          >
            {FUEL_TYPES.map((f) => (
              <option key={f.code} value={f.code}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tank (L)</label>
          <input
            type="number"
            value={tank}
            onChange={(e) => onTankChange(Number(e.target.value))}
            className="w-full px-3 py-2.5 min-h-[44px] border rounded-lg text-base"
            min={10}
            max={200}
            required
          />
        </div>
        <div className="col-span-2 md:col-span-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">L/100km</label>
          <input
            type="number"
            value={consumption}
            onChange={(e) => onConsumptionChange(Number(e.target.value))}
            step={0.1}
            className="w-full px-3 py-2.5 min-h-[44px] border rounded-lg text-base"
            min={3}
            max={30}
            required
          />
        </div>
      </div>

      {/* Jerry cans — opt-in tickbox, litres input only when carrying */}
      <div className="mt-3">
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={hasJerryCans}
            onChange={(e) => onJerryToggle(e.target.checked)}
            className="w-5 h-5 accent-emerald-600"
          />
          <span className="text-sm text-gray-700">I&apos;m carrying jerry cans</span>
        </label>
        {hasJerryCans && (
          <div className="mt-2 flex items-center gap-2 max-w-xs">
            <label htmlFor="jerry-litres" className="text-sm text-gray-700 whitespace-nowrap">
              Capacity (L)
            </label>
            <input
              id="jerry-litres"
              type="number"
              value={jerry}
              onChange={(e) => onJerryChange(Number(e.target.value))}
              className="w-24 px-3 py-2.5 min-h-[44px] border rounded-lg text-base"
              min={0}
              max={200}
              placeholder={String(DEFAULT_JERRY_LITRES)}
            />
            <span className="text-xs text-gray-500">standard jerry can ≈ 20L</span>
          </div>
        )}
      </div>
    </div>
  );
}
