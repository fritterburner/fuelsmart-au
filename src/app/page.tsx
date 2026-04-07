"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import FuelSelect from "@/components/FuelSelect";
import LocationSearch from "@/components/LocationSearch";
import { FuelCode } from "@/lib/types";

// Leaflet must be loaded client-side only (no SSR)
const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

export default function Home() {
  const [fuel, setFuel] = useState<FuelCode>("U91");
  const [flyTo, setFlyTo] = useState<[number, number] | null>(null);

  return (
    <div className="h-screen flex flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-3 p-3 bg-slate-800 text-white shadow-md z-[1000]">
        <h1 className="font-bold text-lg mr-2">FuelSmart AU</h1>
        <LocationSearch onSelect={(lat, lng) => setFlyTo([lat, lng])} />
        <FuelSelect value={fuel} onChange={setFuel} />
        <a href="/trip" className="ml-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium">
          Trip Planner
        </a>
      </div>

      {/* Map */}
      <div className="flex-1">
        <MapView fuel={fuel} flyTo={flyTo} />
      </div>

      {/* Attribution footer */}
      <div className="bg-slate-900 text-gray-400 text-xs px-3 py-1 flex gap-4">
        <span>Data: NT Gov, QLD Gov, <a href="https://www.fuelwatch.wa.gov.au" className="underline">FuelWatch WA</a></span>
        <span>Prices updated daily</span>
      </div>
    </div>
  );
}
