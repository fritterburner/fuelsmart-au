"use client";

import dynamic from "next/dynamic";
import { useState, useRef, useEffect } from "react";
import FuelSelect from "@/components/FuelSelect";
import LocationSearch from "@/components/LocationSearch";
import ExciseToggle from "@/components/ExciseToggle";
import ExciseStatusBar from "@/components/ExciseStatusBar";
import DiscountNudge from "@/components/DiscountNudge";
import { FuelCode } from "@/lib/types";
import { loadSettings, saveSettings } from "@/lib/settings";
import { useMarketData } from "@/lib/useMarketData";

// Leaflet must be loaded client-side only (no SSR)
const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

export default function Home() {
  const [fuel, setFuel] = useState<FuelCode>("U91");
  const [flyTo, setFlyTo] = useState<[number, number] | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [exciseMode, setExciseMode] = useState(false);
  const [cheapestHighlightCount, setCheapestHighlightCount] = useState(3);
  const menuRef = useRef<HTMLDivElement>(null);

  // Hydrate excise-mode + palette preference from localStorage
  useEffect(() => {
    const s = loadSettings();
    setExciseMode(s.exciseMode);
    setCheapestHighlightCount(s.cheapestHighlightCount);
  }, []);

  // Live oil + AUD via /api/market-data (only fetch when excise mode is on)
  const { data: marketData, loading: marketLoading, error: marketError, override } =
    useMarketData(exciseMode);

  function handleToggleExcise(next: boolean) {
    setExciseMode(next);
    const current = loadSettings();
    saveSettings({ ...current, exciseMode: next });
    setMenuOpen(false);
  }

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
    <div className="h-dvh flex flex-col overflow-hidden overscroll-none">
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

          {/* Desktop: inline text buttons */}
          <ExciseToggle
            mode={exciseMode}
            onToggle={handleToggleExcise}
            variant="desktop"
          />

          {exciseMode && (
            <a
              href="/excise"
              className="hidden md:inline-flex items-center justify-center rounded-lg bg-slate-700 md:hover:bg-slate-600 w-9 h-9 transition-colors text-sm"
              title="How excise is calculated"
              aria-label="How excise is calculated"
            >
              ?
            </a>
          )}

          <a
            href="/trip"
            className="hidden md:inline-flex items-center justify-center rounded-lg bg-emerald-600 md:hover:bg-emerald-700 md:px-4 md:py-2 transition-colors"
            title="Trip Planner"
          >
            <span className="text-sm font-medium">🚗 Trip Planner</span>
          </a>

          {/* Three-dot menu — mobile and desktop */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((prev) => !prev)}
              className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 md:w-9 md:h-9 rounded-lg bg-slate-700 md:hover:bg-slate-600 active:bg-slate-600 transition-colors"
              aria-label="Menu"
              aria-expanded={menuOpen}
            >
              <span className="text-xl leading-none">&#8942;</span>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-60 bg-slate-700 rounded-lg shadow-lg overflow-hidden z-[1100]">
                <a
                  href="/fill-up"
                  className="flex items-center gap-2 px-4 py-3 text-sm hover:bg-slate-600 active:bg-slate-600 transition-colors"
                >
                  <span aria-hidden="true">📍</span> Where should I fill up?
                </a>
                <a
                  href="/trip"
                  className="flex items-center gap-2 px-4 py-3 text-sm hover:bg-slate-600 active:bg-slate-600 transition-colors md:hidden"
                >
                  <span aria-hidden="true">🚗</span> Trip Planner
                </a>
                <div className="md:hidden">
                  <ExciseToggle
                    mode={exciseMode}
                    onToggle={handleToggleExcise}
                    variant="mobile-menu"
                  />
                </div>
                <a
                  href="/compare"
                  className="flex items-center gap-2 px-4 py-3 text-sm hover:bg-slate-600 active:bg-slate-600 transition-colors"
                >
                  <span aria-hidden="true">🚙</span> Which car should I drive?
                </a>
                <a
                  href="/discounts"
                  className="flex items-center gap-2 px-4 py-3 text-sm hover:bg-slate-600 active:bg-slate-600 transition-colors"
                >
                  <span aria-hidden="true">💳</span> Cashback vs detour
                </a>
                <a
                  href="/additives"
                  className="flex items-center gap-2 px-4 py-3 text-sm hover:bg-slate-600 active:bg-slate-600 transition-colors"
                >
                  <span aria-hidden="true">🧪</span> Fuel additives: worth it?
                </a>
                <a
                  href="/excise"
                  className="flex items-center gap-2 px-4 py-3 text-sm hover:bg-slate-600 active:bg-slate-600 transition-colors border-t border-slate-600"
                >
                  <span aria-hidden="true">📘</span> How excise is calculated
                </a>
                <a
                  href="/settings"
                  className="flex items-center gap-2 px-4 py-3 text-sm hover:bg-slate-600 active:bg-slate-600 transition-colors border-t border-slate-600"
                >
                  <span aria-hidden="true">⚙️</span> Settings
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Row 2: full-width search on mobile only */}
        <div className="px-3 pb-2 md:hidden">
          <LocationSearch onSelect={(lat, lng) => setFlyTo([lat, lng])} />
        </div>
      </header>

      {/* Excise mode status bar — visible only when mode is on */}
      {exciseMode && (
        <ExciseStatusBar
          data={marketData}
          loading={marketLoading}
          error={marketError}
          overrideActive={!!override}
          override={override}
        />
      )}

      {/* First-run discount nudge (hides itself once dismissed or discounts exist) */}
      <DiscountNudge />

      {/* Map */}
      <div className="flex-1 relative">
        <MapView
          fuel={fuel}
          flyTo={flyTo}
          exciseMode={exciseMode}
          marketData={marketData}
          marketOverride={override}
          cheapestHighlightCount={cheapestHighlightCount}
        />
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
          ,{" "}
          <a
            href="https://www.fuelcheck.nsw.gov.au"
            className="underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            FuelCheck NSW
          </a>
          , FuelCheck TAS
        </span>
        <a href="/data-freshness" className="underline opacity-80">
          Data freshness varies by state →
        </a>
      </footer>
    </div>
  );
}
