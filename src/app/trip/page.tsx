"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import TripForm from "@/components/TripForm";
import TripResults from "@/components/TripResults";
import { TripComparison, TripStrategy, FuelCode } from "@/lib/types";

const TripMap = dynamic(() => import("@/components/TripMap"), { ssr: false });

export default function TripPage() {
  const [comparison, setComparison] = useState<TripComparison | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<TripStrategy>("optimised");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(data: {
    originCoords: [number, number];
    destCoords: [number, number];
    fuel: FuelCode;
    tank: number;
    consumption: number;
    jerry: number;
    startingFuelPct: number;
  }) {
    setLoading(true);
    setError("");
    setComparison(null);
    setSelectedStrategy("optimised");

    const params = new URLSearchParams({
      origin: data.originCoords.join(","),
      dest: data.destCoords.join(","),
      fuel: data.fuel,
      tank: String(data.tank),
      consumption: String(data.consumption),
      jerry: String(data.jerry),
      startFuel: String(data.startingFuelPct),
    });

    const resp = await fetch(`/api/trip-plan?${params}`);
    const result = await resp.json();

    if (resp.ok) {
      setComparison(result);
    } else {
      setError(result.error || "Failed to plan trip");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gray-50">
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
        <h1 className="font-bold text-lg">Trip Planner</h1>
      </div>

      <div className="px-3 py-4 space-y-4 md:max-w-5xl md:mx-auto md:px-4 md:py-6 md:space-y-6">
        <TripForm onSubmit={handleSubmit} loading={loading} />

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm">
            {error}
          </div>
        )}

        {comparison && (
          <>
            <div className="h-56 md:h-96 rounded-xl overflow-hidden border shadow-sm">
              <TripMap comparison={comparison} selectedStrategy={selectedStrategy} />
            </div>
            <TripResults
              comparison={comparison}
              onStrategyChange={setSelectedStrategy}
              selectedStrategy={selectedStrategy}
            />
          </>
        )}
      </div>

      <div className="bg-slate-900 text-gray-400 text-xs px-3 py-1 mt-8">
        Data: NT Gov, QLD Gov, <a href="https://www.fuelwatch.wa.gov.au" className="underline">FuelWatch WA</a>
      </div>
    </div>
  );
}
