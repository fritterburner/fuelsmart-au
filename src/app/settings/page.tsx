"use client";

import { useState, useEffect } from "react";
import { FuelCode } from "@/lib/types";
import { FUEL_TYPES } from "@/lib/fuel-codes";
import { loadSettings, saveSettings, UserSettings } from "@/lib/settings";

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [saved, setSaved] = useState(false);
  const [homeQuery, setHomeQuery] = useState("");

  useEffect(() => {
    const s = loadSettings();
    setSettings(s);
    setHomeQuery(s.homeLabel);
  }, []);

  if (!settings) return null;

  const set = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    setSettings((s) => s ? { ...s, [key]: value } : s);
    setSaved(false);
  };

  async function geocodeHome() {
    if (!homeQuery.trim()) return;
    const resp = await fetch(`/api/geocode?q=${encodeURIComponent(homeQuery)}`);
    const data = await resp.json();
    if (data.length > 0) {
      set("homeLat", Number(data[0].lat));
      set("homeLng", Number(data[0].lon));
      set("homeLabel", data[0].display_name.split(",")[0]);
      setHomeQuery(data[0].display_name.split(",")[0]);
    }
  }

  function handleSave() {
    if (settings) {
      saveSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24 md:pb-6">
      {/* Sticky header with back navigation */}
      <div className="sticky top-0 z-30 bg-slate-800 text-white px-3 py-3 flex items-center gap-3 shadow-md">
        <a
          href="/"
          className="flex items-center justify-center w-10 h-10 min-h-[44px] min-w-[44px] rounded-full hover:bg-slate-700 active:bg-slate-600 transition-colors text-emerald-400"
          aria-label="Back to map"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
          </svg>
        </a>
        <h1 className="font-bold text-lg">Settings</h1>
      </div>

      <div className="max-w-lg mx-auto p-4 md:p-6 space-y-5 md:space-y-6">
        {/* Default fuel type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Default Fuel Type</label>
          <select
            value={settings.defaultFuel}
            onChange={(e) => set("defaultFuel", e.target.value as FuelCode)}
            className="w-full px-3 py-2.5 min-h-[44px] border rounded-lg text-base bg-white"
          >
            {FUEL_TYPES.map((f) => (
              <option key={f.code} value={f.code}>{f.name}</option>
            ))}
          </select>
        </div>

        {/* Vehicle specs — 1 col on xs, 3 col on sm+ */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tank Size (L)</label>
            <input
              type="number"
              value={settings.tankSize}
              onChange={(e) => set("tankSize", Number(e.target.value))}
              className="w-full px-3 py-2.5 min-h-[44px] border rounded-lg text-base"
              min={10} max={200}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">L/100km</label>
            <input
              type="number"
              value={settings.consumption}
              onChange={(e) => set("consumption", Number(e.target.value))}
              className="w-full px-3 py-2.5 min-h-[44px] border rounded-lg text-base"
              step={0.1} min={3} max={30}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Jerry Cans (L)</label>
            <input
              type="number"
              value={settings.jerryCapacity}
              onChange={(e) => set("jerryCapacity", Number(e.target.value))}
              className="w-full px-3 py-2.5 min-h-[44px] border rounded-lg text-base"
              min={0} max={200}
            />
          </div>
        </div>

        {/* Home location */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Home Location</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={homeQuery}
              onChange={(e) => setHomeQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && geocodeHome()}
              placeholder="e.g. Darwin CBD"
              className="flex-1 px-3 py-2.5 min-h-[44px] border rounded-lg text-base"
            />
            <button
              type="button"
              onClick={geocodeHome}
              className="px-4 py-2.5 min-h-[44px] bg-slate-600 hover:bg-slate-700 active:bg-slate-800 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Set
            </button>
          </div>
          {settings.homeLat && (
            <p className="text-xs text-gray-500 mt-1">
              {settings.homeLabel} ({settings.homeLat?.toFixed(4)}, {settings.homeLng?.toFixed(4)})
            </p>
          )}
        </div>

        {/* Save button — inline on desktop */}
        <button
          onClick={handleSave}
          className="hidden md:block w-full py-3 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors"
        >
          {saved ? "Saved!" : "Save Settings"}
        </button>
      </div>

      {/* Sticky save button at bottom on mobile */}
      <div className="fixed bottom-0 inset-x-0 p-3 bg-white border-t border-gray-200 md:hidden z-20">
        <button
          onClick={handleSave}
          className="w-full py-3.5 min-h-[48px] bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-lg transition-colors"
        >
          {saved ? "Saved!" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
