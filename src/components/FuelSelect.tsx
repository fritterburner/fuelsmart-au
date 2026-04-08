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
      className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-600 bg-slate-700 text-white text-sm md:text-sm font-medium shadow-sm focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%23a0aec0%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem] bg-[right_0.5rem_center] bg-no-repeat pr-8 cursor-pointer"
    >
      {FUEL_TYPES.map((f) => (
        <option key={f.code} value={f.code}>
          {f.name}
        </option>
      ))}
    </select>
  );
}
