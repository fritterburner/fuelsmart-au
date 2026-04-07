"use client";

import { FuelCode } from "@/lib/types";
import { FUEL_TYPES } from "@/lib/fuel-codes";

interface Props {
  value: FuelCode;
  onChange: (fuel: FuelCode) => void;
}

export default function FuelSelect({ value, onChange }: Props) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as FuelCode)}
      className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
    >
      {FUEL_TYPES.map((f) => (
        <option key={f.code} value={f.code}>
          {f.name}
        </option>
      ))}
    </select>
  );
}
