"use client";

import { TripComparison, StrategyResult, TripStrategy } from "@/lib/types";

const STRATEGY_COLORS: Record<TripStrategy, { bg: string; border: string; text: string; dot: string }> = {
  optimised: { bg: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-700", dot: "#22c55e" },
  cheapest_fill: { bg: "bg-blue-50", border: "border-blue-300", text: "text-blue-700", dot: "#3b82f6" },
  no_planning: { bg: "bg-orange-50", border: "border-orange-300", text: "text-orange-700", dot: "#f97316" },
};

function StrategyCard({
  result,
  bestCost,
  selected,
  onSelect,
}: {
  result: StrategyResult;
  bestCost: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const colors = STRATEGY_COLORS[result.strategy];
  const extra = result.totalFuelCost - bestCost;

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left rounded-xl p-4 border-2 transition-all ${
        selected ? `${colors.bg} ${colors.border} shadow-md` : "bg-white border-gray-200 hover:border-gray-300"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="w-3 h-3 rounded-full" style={{ background: colors.dot }} />
        <span className={`font-bold text-sm ${selected ? colors.text : "text-gray-700"}`}>
          {result.label}
        </span>
      </div>
      <div className="text-2xl font-bold text-gray-900">${result.totalFuelCost.toFixed(2)}</div>
      <div className="text-xs text-gray-500 mt-1">{result.description}</div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
        <div>
          <div className="font-medium text-gray-900">{result.stops.length}</div>
          <div className="text-gray-500">stops</div>
        </div>
        <div>
          <div className="font-medium text-gray-900">{result.totalLitres.toFixed(0)}L</div>
          <div className="text-gray-500">fuel</div>
        </div>
        <div>
          <div className="font-medium text-gray-900">{result.avgPricePerLitre.toFixed(1)}c</div>
          <div className="text-gray-500">avg/L</div>
        </div>
      </div>
      {extra > 0.5 && (
        <div className="mt-2 text-xs font-medium text-red-600">
          +${extra.toFixed(2)} vs best
        </div>
      )}
      {extra <= 0.5 && extra >= -0.5 && (
        <div className="mt-2 text-xs font-medium text-emerald-600">Best price</div>
      )}
    </button>
  );
}

function StopList({ result }: { result: StrategyResult }) {
  const colors = STRATEGY_COLORS[result.strategy];

  return (
    <div className="space-y-2">
      {result.warnings.map((w, i) => (
        <div key={i} className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          {w}
        </div>
      ))}
      {result.stops.length === 0 && (
        <p className="text-gray-500 text-sm">No fuel stops needed — you can make it on a full tank!</p>
      )}
      {result.stops.map((stop, i) => (
        <div key={i} className={`border rounded-lg p-4 ${colors.bg} ${colors.border}`}>
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold ${colors.text} bg-white px-2 py-0.5 rounded-full`}>
                  Stop {i + 1}
                </span>
                <span className="font-bold text-gray-900">{stop.station.name}</span>
              </div>
              <div className="text-sm text-gray-500 mt-1">
                {stop.station.address}, {stop.station.suburb} {stop.station.state}
              </div>
              <div className="text-sm text-gray-500">{stop.distanceFromStart.toFixed(0)} km from start</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-gray-900">{stop.pricePerLitre.toFixed(1)} c/L</div>
              <div className="text-sm text-gray-700">Add {stop.litresAdded.toFixed(1)}L</div>
              <div className="text-sm font-bold text-gray-900">${stop.cost.toFixed(2)}</div>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-gray-600">
            <span>Arrive: {stop.fuelOnArrival.toFixed(0)}L</span>
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, (stop.fuelOnDeparture / (stop.fuelOnArrival + stop.litresAdded)) * 100)}%`,
                  background: colors.dot,
                }}
              />
            </div>
            <span>Depart: {stop.fuelOnDeparture.toFixed(0)}L</span>
          </div>
        </div>
      ))}
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

  const bestCost = Math.min(...comparison.strategies.map((s) => s.totalFuelCost));
  const selected = comparison.strategies.find((s) => s.strategy === selectedStrategy)!;
  const optimised = comparison.strategies.find((s) => s.strategy === "optimised")!;
  const noPlanning = comparison.strategies.find((s) => s.strategy === "no_planning")!;

  return (
    <div className="space-y-6">
      {/* Distance + savings headline */}
      <div className="text-center">
        <div className="text-3xl font-bold text-gray-900">
          {comparison.totalDistance.toFixed(0)} km
        </div>
        <div className="text-gray-500 text-sm">total distance</div>
        {noPlanning.totalFuelCost - optimised.totalFuelCost > 1 && (
          <div className="mt-2 inline-block bg-emerald-100 text-emerald-800 font-bold px-4 py-1 rounded-full text-sm">
            Save ${(noPlanning.totalFuelCost - optimised.totalFuelCost).toFixed(2)} with smart planning
          </div>
        )}
      </div>

      {/* Strategy comparison cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {comparison.strategies.map((result) => (
          <StrategyCard
            key={result.strategy}
            result={result}
            bestCost={bestCost}
            selected={selectedStrategy === result.strategy}
            onSelect={() => setSelectedStrategy(result.strategy)}
          />
        ))}
      </div>

      {/* Selected strategy stops */}
      <div>
        <h3 className="font-bold text-lg flex items-center gap-2 mb-3">
          <div
            className="w-3 h-3 rounded-full"
            style={{ background: STRATEGY_COLORS[selectedStrategy].dot }}
          />
          {selected.label} — {selected.stops.length} stop{selected.stops.length !== 1 ? "s" : ""}
        </h3>
        <StopList result={selected} />
      </div>
    </div>
  );
}
