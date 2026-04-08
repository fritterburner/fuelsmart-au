"use client";

import dynamic from "next/dynamic";
import { useState, useRef, useEffect } from "react";
import FuelSelect from "@/components/FuelSelect";
import LocationSearch from "@/components/LocationSearch";
import { FuelCode } from "@/lib/types";

// Leaflet must be loaded client-side only (no SSR)
const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

export default function Home() {
  const [fuel, setFuel] = useState<FuelCode>("U91");
  const [flyTo, setFlyTo] = useState<[number, number] | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  return (
    <div className="h-dvh flex flex-col">
      {/* Header — two rows on mobile, single row on md+ */}
      <header className="bg-slate-800 text-white shadow-md z-[1000] safe-area-top safe-area-inset">
        {/* Row 1: logo + fuel select + action icons */}
        <div className="flex items-center gap-2 px-3 pt-2 pb-1 md:gap-3 md:px-4 md:py-2">
          <h1 className="font-bold text-base md:text-lg whitespace-nowrap mr-1">
            FuelSmart AU
          </h1>

          {/* Desktop-only: inline search */}
          <div className="hidden md:block md:flex-1 md:max-w-md">
            <LocationSearch onSelect={(lat, lng) => setFlyTo([lat, lng])} />
          </div>

          <FuelSelect value={fuel} onChange={setFuel} />

          {/* Spacer pushes action buttons right */}
          <div className="flex-1 md:flex-none" />

          {/* Mobile: three-dot menu */}
          <div className="relative md:hidden" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((prev) => !prev)}
              className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg bg-slate-700 active:bg-slate-600 transition-colors"
              aria-label="Menu"
              aria-expanded={menuOpen}
            >
              <span className="text-xl leading-none">&#8942;</span>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-slate-700 rounded-lg shadow-lg overflow-hidden z-[1100]">
                <a
                  href="/trip"
                  className="flex items-center gap-2 px-4 py-3 text-sm hover:bg-slate-600 active:bg-slate-600 transition-colors"
                >
                  <span aria-hidden="true">🚗</span> Trip Planner
                </a>
                <a
                  href="/settings"
                  className="flex items-center gap-2 px-4 py-3 text-sm hover:bg-slate-600 active:bg-slate-600 transition-colors"
                >
                  <span aria-hidden="true">⚙️</span> Settings
                </a>
              </div>
            )}
          </div>

          {/* Desktop: inline text buttons */}
          <a
            href="/trip"
            className="hidden md:inline-flex items-center justify-center rounded-lg bg-emerald-600 md:hover:bg-emerald-700 md:px-4 md:py-2 transition-colors"
            title="Trip Planner"
          >
            <span className="text-sm font-medium">🚗 Trip Planner</span>
          </a>

          <a
            href="/settings"
            className="hidden md:inline-flex items-center justify-center rounded-lg bg-slate-700 md:hover:bg-slate-600 md:px-3 md:py-2 transition-colors"
            title="Settings"
          >
            <span className="text-sm font-medium">Settings</span>
          </a>
        </div>

        {/* Row 2: full-width search on mobile only */}
        <div className="px-3 pb-2 md:hidden">
          <LocationSearch onSelect={(lat, lng) => setFlyTo([lat, lng])} />
        </div>
      </header>

      {/* Map */}
      <div className="flex-1 relative">
        <MapView fuel={fuel} flyTo={flyTo} />
      </div>

      {/* Attribution footer */}
      <footer className="bg-slate-900 text-gray-400 text-[10px] md:text-xs px-3 py-1 flex flex-wrap gap-x-4 gap-y-0.5 safe-area-bottom safe-area-inset">
        <span>
          Data: NT Gov, QLD Gov,{" "}
          <a
            href="https://www.fuelwatch.wa.gov.au"
            className="underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            FuelWatch WA
          </a>
        </span>
        <span>Prices updated daily</span>
      </footer>
    </div>
  );
}
