"use client";

import dynamic from "next/dynamic";
import { useState, useRef, useEffect } from "react";
import FuelSelect from "@/components/FuelSelect";
import LocationSearch from "@/components/LocationSearch";
import ExciseToggle from "@/components/ExciseToggle";
import ExciseStatusBar from "@/components/ExciseStatusBar";
import DiscountNudge from "@/components/DiscountNudge";
import BottomSheet from "@/components/BottomSheet";
import { FuelCode } from "@/lib/types";
import { FUEL_TYPES } from "@/lib/fuel-codes";
import { loadSettings, saveSettings } from "@/lib/settings";
import { useMarketData } from "@/lib/useMarketData";

// Leaflet must be loaded client-side only (no SSR)
const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

export default function Home() {
  const [fuel, setFuel] = useState<FuelCode>("U91");
  const [flyTo, setFlyTo] = useState<[number, number] | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [fuelSheetOpen, setFuelSheetOpen] = useState(false);
  const [searchSheetOpen, setSearchSheetOpen] = useState(false);
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
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen]);

  const selectedFuel = FUEL_TYPES.find((f) => f.code === fuel);

  function handleSearchSelect(lat: number, lng: number) {
    setFlyTo([lat, lng]);
    setSearchSheetOpen(false);
  }

  function handleFuelSelect(code: FuelCode) {
    setFuel(code);
    setFuelSheetOpen(false);
  }

  return (
    <div className="h-dvh w-screen relative overflow-hidden overscroll-none">
      {/* ---------- Desktop side panel (md+) ---------- */}
      <aside className="hidden md:flex md:flex-col absolute left-0 top-0 bottom-0 w-96 bg-slate-800 text-white z-[1000] shadow-xl safe-area-top safe-area-inset">
        <div className="px-4 py-3 border-b border-slate-700">
          <h1 className="font-bold text-lg whitespace-nowrap">FuelSmart AU</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Live fuel prices across Australia
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-3 space-y-3">
            <LocationSearch onSelect={(lat, lng) => setFlyTo([lat, lng])} />
            <FuelSelect value={fuel} onChange={setFuel} />
          </div>

          {exciseMode && (
            <ExciseStatusBar
              data={marketData}
              loading={marketLoading}
              error={marketError}
              overrideActive={!!override}
              override={override}
            />
          )}

          <div className="px-4 py-3 grid grid-cols-2 gap-2">
            <a
              href="/fill-up"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-2 text-sm font-medium transition-colors"
            >
              <span aria-hidden="true">📍</span> Find a stop
            </a>
            <a
              href="/trip"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-2 text-sm font-medium transition-colors"
            >
              <span aria-hidden="true">🚗</span> Plan a trip
            </a>
          </div>

          <div className="px-4 pb-3">
            <DiscountNudge variant="inline" />
          </div>

          <nav className="border-t border-slate-700 py-2" aria-label="Tools">
            <ExciseToggle
              mode={exciseMode}
              onToggle={handleToggleExcise}
              variant="mobile-menu"
            />
            <a
              href="/excise"
              className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-slate-700 transition-colors"
            >
              <span aria-hidden="true">📘</span> How excise is calculated
            </a>
            <a
              href="/compare"
              className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-slate-700 transition-colors"
            >
              <span aria-hidden="true">🚙</span> Compare running costs
            </a>
            <a
              href="/additives"
              className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-slate-700 transition-colors"
            >
              <span aria-hidden="true">🧪</span> Fuel additives: worth it?
            </a>
            <a
              href="/discounts"
              className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-slate-700 transition-colors"
            >
              <span aria-hidden="true">💳</span> Discounts &amp; loyalty
            </a>
            <a
              href="/settings"
              className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-slate-700 transition-colors"
            >
              <span aria-hidden="true">⚙️</span> Settings
            </a>
          </nav>
        </div>

        <footer className="border-t border-slate-700 px-4 py-2 text-[11px] text-slate-400 leading-snug safe-area-bottom">
          <div>
            Data: NT Gov, QLD Gov,{" "}
            <a href="https://www.fuelwatch.wa.gov.au" className="underline" target="_blank" rel="noopener noreferrer">
              FuelWatch WA
            </a>
            ,{" "}
            <a href="https://www.fuelcheck.nsw.gov.au" className="underline" target="_blank" rel="noopener noreferrer">
              FuelCheck NSW
            </a>
            , FuelCheck TAS
          </div>
          <a href="/data-freshness" className="underline opacity-80 mt-1 inline-block">
            Data freshness varies by state →
          </a>
        </footer>
      </aside>

      {/* ---------- Map (full bleed, offset by side panel on desktop) ---------- */}
      <div className="absolute inset-0 md:left-96">
        <MapView
          fuel={fuel}
          flyTo={flyTo}
          exciseMode={exciseMode}
          marketData={marketData}
          marketOverride={override}
          cheapestHighlightCount={cheapestHighlightCount}
        />
      </div>

      {/* ---------- Mobile floating top bar (md:hidden) ---------- */}
      <header className="md:hidden absolute top-0 left-0 right-0 z-[1000] safe-area-top safe-area-inset pointer-events-none">
        <div className="px-2 pt-2 pointer-events-auto">
          <div className="bg-slate-800/95 backdrop-blur-sm text-white rounded-xl shadow-lg flex items-center gap-1 px-1.5 py-1.5">
            <span className="font-bold text-sm whitespace-nowrap pl-2 pr-1">
              FuelSmart
            </span>

            <div className="flex-1" />

            {/* Fuel pill */}
            <button
              type="button"
              onClick={() => setFuelSheetOpen(true)}
              className="inline-flex items-center gap-1 min-h-[40px] px-3 rounded-lg bg-emerald-600 active:bg-emerald-700 text-sm font-medium transition-colors"
              aria-label={`Fuel type: ${selectedFuel?.name ?? fuel}. Tap to change.`}
            >
              <span>{selectedFuel?.short ?? fuel}</span>
              <span aria-hidden="true" className="text-xs opacity-80">▾</span>
            </button>

            {/* Search */}
            <button
              type="button"
              onClick={() => setSearchSheetOpen(true)}
              className="inline-flex items-center justify-center min-w-[40px] min-h-[40px] rounded-lg bg-slate-700 active:bg-slate-600 transition-colors"
              aria-label="Search location"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>

            {/* Kebab menu */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((p) => !p)}
                className="inline-flex items-center justify-center min-w-[40px] min-h-[40px] rounded-lg bg-slate-700 active:bg-slate-600 transition-colors"
                aria-label="Menu"
                aria-expanded={menuOpen}
              >
                <span className="text-xl leading-none">&#8942;</span>
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  aria-label="Main menu"
                  className="absolute right-0 top-full mt-1 w-60 bg-slate-700 rounded-lg shadow-xl overflow-hidden z-[1100]"
                >
                  <a
                    role="menuitem"
                    href="/fill-up"
                    className="flex items-center gap-2 px-4 py-3 text-sm hover:bg-slate-600 active:bg-slate-600 transition-colors"
                  >
                    <span aria-hidden="true">📍</span> Find a stop
                  </a>
                  <a
                    role="menuitem"
                    href="/trip"
                    className="flex items-center gap-2 px-4 py-3 text-sm hover:bg-slate-600 active:bg-slate-600 transition-colors border-b border-slate-600"
                  >
                    <span aria-hidden="true">🚗</span> Plan a trip
                  </a>

                  <div role="none">
                    <ExciseToggle
                      mode={exciseMode}
                      onToggle={handleToggleExcise}
                      variant="mobile-menu"
                    />
                  </div>
                  <a
                    role="menuitem"
                    href="/excise"
                    className="flex items-center gap-2 px-4 py-3 text-sm hover:bg-slate-600 active:bg-slate-600 transition-colors"
                  >
                    <span aria-hidden="true">📘</span> How excise is calculated
                  </a>

                  <a
                    role="menuitem"
                    href="/compare"
                    className="flex items-center gap-2 px-4 py-3 text-sm hover:bg-slate-600 active:bg-slate-600 transition-colors border-t border-slate-600"
                  >
                    <span aria-hidden="true">🚙</span> Compare running costs
                  </a>
                  <a
                    role="menuitem"
                    href="/additives"
                    className="flex items-center gap-2 px-4 py-3 text-sm hover:bg-slate-600 active:bg-slate-600 transition-colors"
                  >
                    <span aria-hidden="true">🧪</span> Fuel additives: worth it?
                  </a>

                  <a
                    role="menuitem"
                    href="/discounts"
                    className="flex items-center gap-2 px-4 py-3 text-sm hover:bg-slate-600 active:bg-slate-600 transition-colors border-t border-slate-600"
                  >
                    <span aria-hidden="true">💳</span> Discounts &amp; loyalty
                  </a>
                  <a
                    role="menuitem"
                    href="/settings"
                    className="flex items-center gap-2 px-4 py-3 text-sm hover:bg-slate-600 active:bg-slate-600 transition-colors"
                  >
                    <span aria-hidden="true">⚙️</span> Settings
                  </a>
                  <a
                    role="menuitem"
                    href="/data-freshness"
                    className="flex items-center gap-2 px-4 py-3 text-xs text-slate-300 hover:bg-slate-600 active:bg-slate-600 transition-colors border-t border-slate-600"
                  >
                    <span aria-hidden="true">ℹ️</span> Data sources &amp; freshness
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Excise status bar (mobile) — pinned just below the floating top bar */}
          {exciseMode && (
            <div className="mt-1.5 rounded-xl overflow-hidden shadow-md">
              <ExciseStatusBar
                data={marketData}
                loading={marketLoading}
                error={marketError}
                overrideActive={!!override}
                override={override}
              />
            </div>
          )}
        </div>
      </header>

      {/* ---------- Mobile bottom sheets ---------- */}
      <BottomSheet
        open={fuelSheetOpen}
        onClose={() => setFuelSheetOpen(false)}
        title="Fuel type"
      >
        <div className="grid grid-cols-2 gap-2">
          {FUEL_TYPES.map((f) => {
            const isActive = fuel === f.code;
            return (
              <button
                key={f.code}
                type="button"
                onClick={() => handleFuelSelect(f.code)}
                aria-pressed={isActive}
                className={`min-h-[48px] px-3 py-2 rounded-lg border text-sm font-medium transition-colors text-left ${
                  isActive
                    ? "bg-emerald-600 text-white border-emerald-500"
                    : "bg-white text-slate-900 border-slate-300 active:bg-slate-100"
                }`}
              >
                <div className="font-semibold">{f.short}</div>
                <div className={`text-xs ${isActive ? "text-emerald-100" : "text-slate-500"}`}>
                  {f.name}
                </div>
              </button>
            );
          })}
        </div>
      </BottomSheet>

      <BottomSheet
        open={searchSheetOpen}
        onClose={() => setSearchSheetOpen(false)}
        title="Search location"
      >
        <LocationSearch onSelect={handleSearchSelect} />
      </BottomSheet>

      {/* ---------- Mobile floating discount snackbar ---------- */}
      <DiscountNudge />
    </div>
  );
}
