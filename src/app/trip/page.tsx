"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import TripForm from "@/components/TripForm";
import TripResults from "@/components/TripResults";
import { TripPlan, FuelCode } from "@/lib/types";

const TripMap = dynamic(() => import("@/components/TripMap"), { ssr: false });

export default function TripPage() {
  const [plan, setPlan] = useState<TripPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(data: {
    originCoords: [number, number];
    destCoords: [number, number];
    fuel: FuelCode;
    tank: number;
    consumption: number;
    jerry: number;
  }) {
    setLoading(true);
    setError("");
    setPlan(null);

    const params = new URLSearchParams({
      origin: data.originCoords.join(","),
      dest: data.destCoords.join(","),
      fuel: data.fuel,
      tank: String(data.tank),
      consumption: String(data.consumption),
      jerry: String(data.jerry),
    });

    const resp = await fetch(`/api/trip-plan?${params}`);
    const result = await resp.json();

    if (resp.ok) {
      setPlan(result);
    } else {
      setError(result.error || "Failed to plan trip");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-slate-800 text-white px-4 py-3 flex items-center gap-4">
        <a href="/" className="text-emerald-400 hover:text-emerald-300 font-medium">&larr; Map</a>
        <h1 className="font-bold text-lg">Trip Planner</h1>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        <TripForm onSubmit={handleSubmit} loading={loading} />

        {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800">{error}</div>}

        {plan && (
          <>
            <div className="h-96 rounded-lg overflow-hidden border">
              <TripMap plan={plan} />
            </div>
            <TripResults plan={plan} />
          </>
        )}
      </div>

      <div className="bg-slate-900 text-gray-400 text-xs px-3 py-1 mt-8">
        Data: NT Gov, QLD Gov, <a href="https://www.fuelwatch.wa.gov.au" className="underline">FuelWatch WA</a>
      </div>
    </div>
  );
}
