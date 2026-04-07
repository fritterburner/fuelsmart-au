"use client";

import { TripPlan } from "@/lib/types";

export default function TripResults({ plan }: { plan: TripPlan }) {
  return (
    <div className="space-y-4">
      {/* Summary card */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold">{plan.totalDistance.toFixed(0)} km</div>
            <div className="text-sm text-gray-600">Total Distance</div>
          </div>
          <div>
            <div className="text-2xl font-bold">${plan.totalFuelCost.toFixed(2)}</div>
            <div className="text-sm text-gray-600">Optimised Cost</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-400">${plan.naiveFuelCost.toFixed(2)}</div>
            <div className="text-sm text-gray-600">Without Planning</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-600">${plan.savings.toFixed(2)}</div>
            <div className="text-sm text-gray-600">You Save</div>
          </div>
        </div>
      </div>

      {/* Warnings */}
      {plan.warnings.map((w, i) => (
        <div key={i} className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">{w}</div>
      ))}

      {/* Stop list */}
      <div className="space-y-2">
        <h3 className="font-bold text-lg">Recommended Stops</h3>
        {plan.stops.length === 0 && (
          <p className="text-gray-500">No fuel stops needed — you can make it on a full tank!</p>
        )}
        {plan.stops.map((stop, i) => (
          <div key={i} className="border rounded-lg p-4 bg-white">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-bold">{stop.station.name}</div>
                <div className="text-sm text-gray-500">
                  {stop.station.address}, {stop.station.suburb} {stop.station.state}
                </div>
                <div className="text-sm text-gray-500">
                  {stop.distanceFromStart.toFixed(0)} km from start
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold">{stop.pricePerLitre.toFixed(1)} c/L</div>
                <div className="text-sm">Add {stop.litresAdded.toFixed(1)}L</div>
                <div className="text-sm font-medium">${stop.cost.toFixed(2)}</div>
              </div>
            </div>
            {/* Fuel gauge */}
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span>Arrive: {stop.fuelOnArrival.toFixed(0)}L</span>
              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${(stop.fuelOnDeparture / (stop.fuelOnArrival + stop.litresAdded)) * 100}%` }}
                />
              </div>
              <span>Depart: {stop.fuelOnDeparture.toFixed(0)}L</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
