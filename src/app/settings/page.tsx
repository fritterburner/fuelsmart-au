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
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(homeQuery + " Australia")}&format=json&limit=1`
    );
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
    <div className="min-h-screen bg-gray-50">
      <div className="bg-slate-800 text-white px-4 py-3 flex items-center gap-4">
        <a href="/" className="text-emerald-400 hover:text-emerald-300 font-medium">&larr; Map</a>
        <h1 className="font-bold text-lg">Settings</h1>
      </div>

      <div className="max-w-lg mx-auto p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Default Fuel Type</label>
          <select
            value={settings.defaultFuel}
            onChange={(e) => set("defaultFuel", e.target.value as FuelCode)}
            className="w-full px-3 py-2 border rounded-lg"
          >
            {FUEL_TYPES.map((f) => (
              <option key={f.code} value={f.code}>{f.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tank Size (L)</label>
            <input
              type="number"
              value={settings.tankSize}
              onChange={(e) => set("tankSize", Number(e.target.value))}
              className="w-full px-3 py-2 border rounded-lg"
              min={10} max={200}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">L/100km</label>
            <input
              type="number"
              value={settings.consumption}
              onChange={(e) => set("consumption", Number(e.target.value))}
              className="w-full px-3 py-2 border rounded-lg"
              step={0.1} min={3} max={30}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Jerry Cans (L)</label>
            <input
              type="number"
              value={settings.jerryCapacity}
              onChange={(e) => set("jerryCapacity", Number(e.target.value))}
              className="w-full px-3 py-2 border rounded-lg"
              min={0} max={200}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Home Location</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={homeQuery}
              onChange={(e) => setHomeQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && geocodeHome()}
              placeholder="e.g. Darwin CBD"
              className="flex-1 px-3 py-2 border rounded-lg"
            />
            <button
              type="button"
              onClick={geocodeHome}
              className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-sm"
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

        <button
          onClick={handleSave}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg"
        >
          {saved ? "Saved!" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
