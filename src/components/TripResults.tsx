"use client";

import { TripComparison, StrategyResult, TripStrategy } from "@/lib/types";
import StationNavLinks from "./StationNavLinks";

/** "1h 23m" / "47m" / "2h" — abbreviated drive time shown per stop. */
function formatDrive(seconds: number): string {
  if (!seconds || seconds <= 0) return "";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

const STRATEGY_COLORS: Record<TripStrategy, { bg: string; border: string; text: string; dot: string }> = {
  optimised: { bg: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-700", dot: "#22c55e" },
  cheapest_fill: { bg: "bg-blue-50", border: "border-blue-300", text: "text-blue-700", dot: "#3b82f6" },
  no_planning: { bg: "bg-orange-50", border: "border-orange-300", text: "text-orange-700", dot: "#f97316" },
};

function StrategyCard({
  result,
  bestTrueCost,
  hasDestFuel,
  selected,
  onSelect,
}: {
  result: StrategyResult;
  bestTrueCost: number;
  hasDestFuel: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const colors = STRATEGY_COLORS[result.strategy];
  const compareCost = hasDestFuel ? result.trueTripCost : result.totalFuelCost;
  const extra = compareCost - bestTrueCost;

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left rounded-xl p-3 md:p-4 border-2 transition-all min-h-[44px] ${
        selected ? `${colors.bg} ${colors.border} shadow-md` : "bg-white border-gray-200 hover:border-gray-300 active:border-gray-400"
      }`}
    >
      {/* Header row: label dot, name, savings badge inline */}
      <div className="flex items-center gap-2 mb-1.5 md:mb-2">
        <div className="w-3 h-3 rounded-full shrink-0" style={{ background: colors.dot }} />
        <span className={`font-bold text-sm ${selected ? colors.text : "text-gray-700"}`}>
          {result.label}
        </span>
        <span className="ml-auto">
          {extra > 0.5 && (
            <span className="text-xs font-medium text-red-600 whitespace-nowrap">
              +${extra.toFixed(2)}
            </span>
          )}
          {extra <= 0.5 && extra >= -0.5 && (
            <span className="text-xs font-medium text-emerald-600 whitespace-nowrap">Best</span>
          )}
        </span>
      </div>

      {/* Price */}
      {hasDestFuel ? (
        <>
          <div className="text-xl md:text-2xl font-bold text-gray-900">
            ${result.trueTripCost.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            Trip ${result.totalFuelCost.toFixed(2)} + dest fill ${result.destinationFillCost.toFixed(2)}
          </div>
        </>
      ) : (
        <div className="text-xl md:text-2xl font-bold text-gray-900">${result.totalFuelCost.toFixed(2)}</div>
      )}
      <div className="text-xs text-gray-500 mt-0.5 md:mt-1 hidden md:block">{result.description}</div>

      {/* Stats with full labels at every breakpoint — easier to scan than four bare numbers.
          Avg c/L is volume-weighted across the strategy's stops; surfacing it makes
          source-data outliers (e.g. a 31.7 c/L marina row) visible at a glance. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-xs">
        <div>
          <span className="font-medium text-gray-900">{result.stops.length}</span>
          <span className="text-gray-500"> stop{result.stops.length !== 1 ? "s" : ""}</span>
        </div>
        <div>
          <span className="font-medium text-gray-900">{result.totalLitres.toFixed(0)}L</span>
          <span className="text-gray-500"> fuel</span>
        </div>
        {result.totalLitres > 0 && Number.isFinite(result.totalFuelCost / result.totalLitres) ? (
          <div>
            <span className="font-medium text-gray-900">
              {((result.totalFuelCost / result.totalLitres) * 100).toFixed(0)} c/L
            </span>
            <span className="text-gray-500"> avg</span>
          </div>
        ) : (
          <div />
        )}
        <div>
          <span className="font-medium text-gray-900">{result.fuelAtDestination.toFixed(0)}L</span>
          <span className="text-gray-500"> arrival</span>
        </div>
      </div>
    </button>
  );
}

function StopList({
  result,
  totalDistance,
  totalDurationSeconds,
}: {
  result: StrategyResult;
  totalDistance: number;
  totalDurationSeconds: number;
}) {
  const colors = STRATEGY_COLORS[result.strategy];

  return (
    <div className="space-y-2">
      {result.warnings.map((w, i) => (
        <div key={i} className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          {w}
        </div>
      ))}
      {result.stops.length === 0 && (
        <p className="text-gray-500 text-sm">No fuel stops needed -- you can make it on a full tank!</p>
      )}
      {result.stops.map((stop, i) => {
        const driveSeconds =
          totalDistance > 0 && totalDurationSeconds > 0
            ? (stop.distanceFromStart / totalDistance) * totalDurationSeconds
            : 0;
        const driveLabel = formatDrive(driveSeconds);
        return (
        <div key={i} className={`border rounded-lg p-3 md:p-4 ${colors.bg} ${colors.border}`}>
          {/* Header: stop badge + station name */}
          <div className="flex items-start gap-2 mb-1">
            <span className={`text-xs font-bold ${colors.text} bg-white px-2 py-0.5 rounded-full shrink-0`}>
              Stop {i + 1}
            </span>
            <span className="font-bold text-gray-900 text-sm md:text-base">{stop.station.name}</span>
          </div>

          {/* Address + distance + drive time */}
          <div className="text-sm text-gray-500">
            {stop.station.address}, {stop.station.suburb} {stop.station.state}
          </div>
          <div className="text-sm text-gray-500 mb-2">
            {stop.distanceFromStart.toFixed(0)} km from start
            {driveLabel && <> · {driveLabel} drive</>}
          </div>

          {/* Price details — stacked on mobile, inline on desktop */}
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm mb-2">
            <span className="text-base md:text-lg font-bold text-gray-900">{stop.pricePerLitre.toFixed(1)} c/L</span>
            {stop.fallbackFuel && (
              <span className="text-xs font-medium bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                {stop.fallbackFuel}
              </span>
            )}
            <span className="text-gray-700">Add {stop.litresAdded.toFixed(1)}L</span>
            <span className="font-bold text-gray-900">${stop.cost.toFixed(2)}</span>
          </div>

          {/* Fuel gauge bar — taller on mobile for readability */}
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <span className="shrink-0">Arrive {stop.fuelOnArrival.toFixed(0)}L</span>
            <div className="flex-1 h-3 md:h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, (stop.fuelOnDeparture / (stop.fuelOnArrival + stop.litresAdded)) * 100)}%`,
                  background: colors.dot,
                }}
              />
            </div>
            <span className="shrink-0">Depart {stop.fuelOnDeparture.toFixed(0)}L</span>
          </div>

          <StationNavLinks
            lat={stop.station.lat}
            lng={stop.station.lng}
            name={stop.station.name}
          />
        </div>
        );
      })}
    </div>
  );
}

export default function TripResults({
  comparison,
  selectedStrategy,
  onStrategyChange,
}: {
  comparison: TripComparison;
  selectedStrategy: TripStrategy;
  onStrategyChange: (s: TripStrategy) => void;
}) {
  const setSelectedStrategy = onStrategyChange;

  const hasDestFuel = !!comparison.destinationFuel;
  const bestTrueCost = Math.min(
    ...comparison.strategies.map((s) => (hasDestFuel ? s.trueTripCost : s.totalFuelCost))
  );
  const selected = comparison.strategies.find((s) => s.strategy === selectedStrategy)!;
  const optimised = comparison.strategies.find((s) => s.strategy === "optimised")!;
  const noPlanning = comparison.strategies.find((s) => s.strategy === "no_planning")!;

  const savingsValue = hasDestFuel
    ? noPlanning.trueTripCost - optimised.trueTripCost
    : noPlanning.totalFuelCost - optimised.totalFuelCost;

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Distance + savings headline */}
      <div className="text-center">
        <div className="text-2xl md:text-3xl font-bold text-gray-900">
          {comparison.totalDistance.toFixed(0)} km
        </div>
        <div className="text-gray-500 text-sm">total distance</div>
        {savingsValue > 1 && (
          <div className="mt-2 inline-block bg-emerald-100 text-emerald-800 font-bold px-3 md:px-4 py-1 rounded-full text-sm">
            Save ${savingsValue.toFixed(2)} with smart planning
          </div>
        )}
      </div>

      {/* Destination fuel callout */}
      {comparison.destinationFuel && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm">
          <div className="flex items-center gap-2 text-slate-700">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-slate-400 shrink-0">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
            </svg>
            <span>
              Cheapest {comparison.destinationFuel.fuel} near destination:{" "}
              <strong>{comparison.destinationFuel.price.toFixed(1)} c/L</strong> at{" "}
              {comparison.destinationFuel.stationName}
              <span className="text-slate-500"> ({comparison.destinationFuel.distance.toFixed(0)} km away)</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 ml-6">
            True trip cost includes filling to full at this price on arrival
          </p>
        </div>
      )}

      {/* Strategy comparison cards — stacked on mobile, 3-col grid on md+ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-3">
        {comparison.strategies.map((result) => (
          <StrategyCard
            key={result.strategy}
            result={result}
            bestTrueCost={bestTrueCost}
            hasDestFuel={hasDestFuel}
            selected={selectedStrategy === result.strategy}
            onSelect={() => setSelectedStrategy(result.strategy)}
          />
        ))}
      </div>

      {/* Selected strategy stops */}
      <div>
        <h3 className="font-bold text-base md:text-lg flex items-center gap-2 mb-3">
          <div
            className="w-3 h-3 rounded-full"
            style={{ background: STRATEGY_COLORS[selectedStrategy].dot }}
          />
          {selected.label} — {selected.stops.length} stop{selected.stops.length !== 1 ? "s" : ""}
        </h3>
        <StopList
          result={selected}
          totalDistance={comparison.totalDistance}
          totalDurationSeconds={comparison.totalDurationSeconds}
        />
      </div>
    </div>
  );
}
