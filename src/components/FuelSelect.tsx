"use client";

import { useEffect, useRef, useState } from "react";
import { FuelCode } from "@/lib/types";
import { FUEL_TYPES } from "@/lib/fuel-codes";

interface Props {
  value: FuelCode;
  onChange: (fuel: FuelCode) => void;
}

const PRIMARY = FUEL_TYPES.filter((f) => f.primary);
const SECONDARY = FUEL_TYPES.filter((f) => !f.primary);

export default function FuelSelect({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = FUEL_TYPES.find((f) => f.code === value);
  const selectedIsSecondary = !!selected && !selected.primary;

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  function handleSelect(code: FuelCode) {
    onChange(code);
    setOpen(false);
  }

  const baseChip =
    "min-h-[44px] md:min-h-0 md:h-9 px-3 rounded-lg border text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400";
  const activeChip = "bg-emerald-600 text-white border-emerald-500";
  const idleChip =
    "bg-slate-700 text-gray-200 border-slate-600 md:hover:bg-slate-600 active:bg-slate-600";

  const moreActive = selectedIsSecondary;
  const moreLabel = moreActive ? selected!.short : "More";

  return (
    <div
      ref={containerRef}
      className="relative flex items-center gap-1.5 flex-wrap md:flex-nowrap"
      role="group"
      aria-label="Fuel type"
    >
      {PRIMARY.map((f) => {
        const isActive = value === f.code;
        return (
          <button
            key={f.code}
            type="button"
            onClick={() => handleSelect(f.code)}
            className={`${baseChip} ${isActive ? activeChip : idleChip}`}
            aria-pressed={isActive}
            aria-label={f.name}
            title={f.name}
          >
            {f.short}
          </button>
        );
      })}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${baseChip} ${moreActive ? activeChip : idleChip} flex items-center gap-1`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={
          moreActive
            ? `Fuel type: ${selected!.name}. Open other fuel types.`
            : "More fuel types"
        }
        title={moreActive ? selected!.name : "Other fuel types"}
      >
        <span>{moreLabel}</span>
        <span aria-hidden="true" className="text-xs opacity-80">
          ▾
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Other fuel types"
          className="absolute top-full right-0 md:right-auto md:left-0 mt-1 w-56 bg-slate-700 border border-slate-600 rounded-lg shadow-lg overflow-hidden z-[1100]"
        >
          <div className="px-3 py-1.5 text-[11px] uppercase tracking-wide text-gray-400 bg-slate-800 border-b border-slate-600">
            Other fuel types
          </div>
          {SECONDARY.map((f) => {
            const isActive = value === f.code;
            return (
              <button
                key={f.code}
                type="button"
                role="option"
                onClick={() => handleSelect(f.code)}
                aria-selected={isActive}
                className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${
                  isActive
                    ? "bg-emerald-600 text-white"
                    : "text-gray-200 hover:bg-slate-600 active:bg-slate-600"
                }`}
              >
                {f.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
