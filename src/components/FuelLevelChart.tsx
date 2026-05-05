"use client";

/**
 * Hand-rolled SVG line chart of tank fuel level vs distance for one strategy.
 *
 * Why custom SVG instead of recharts/chart.js: ten data points and a small
 * design system don't justify the bundle cost or the visual override fight.
 * The chart fits the rest of the app's aesthetic better when we own the markup.
 *
 * The line traces:
 *   start -> (each stop: arrive then depart, vertical jump up) -> arrival
 * If the comparison has a destination-fill price, a dashed segment continues
 * from the arrival point up to 100% — visually answering "but where do I get
 * a full tank?" without burying the answer in the per-strategy card text.
 *
 * Tappable circles at each stop; tapping opens a tooltip with station + price.
 * Tapping the same dot again, or another dot, dismisses or moves the tooltip.
 */

import { useState, useMemo } from "react";
import type { StrategyResult, DestinationFuelInfo } from "@/lib/types";

interface Props {
  result: StrategyResult;
  totalDistance: number;
  totalCapacity: number;
  startingFuelLitres: number;
  reserveLitres: number;
  destinationFuel?: DestinationFuelInfo;
  /** Hex/css colour for the curve and stop dots — usually the strategy colour. */
  color: string;
}

interface ChartPoint {
  km: number;
  litres: number;
  /** Index into `result.stops`, set on the arrive/depart pair so taps can find them. */
  stopIndex?: number;
  kind: "start" | "arrive" | "depart" | "end";
}

// Layout constants (viewBox units; SVG scales to container width).
const VB_W = 800;
const VB_H = 220;
const PAD_L = 40;
const PAD_R = 14;
const PAD_T = 14;
const PAD_B = 28;
const CHART_W = VB_W - PAD_L - PAD_R;
const CHART_H = VB_H - PAD_T - PAD_B;

export default function FuelLevelChart({
  result,
  totalDistance,
  totalCapacity,
  startingFuelLitres,
  reserveLitres,
  destinationFuel,
  color,
}: Props) {
  const [selected, setSelected] = useState<number | null>(null);

  const points: ChartPoint[] = useMemo(() => {
    const pts: ChartPoint[] = [
      { km: 0, litres: startingFuelLitres, kind: "start" },
    ];
    result.stops.forEach((s, i) => {
      pts.push({ km: s.distanceFromStart, litres: s.fuelOnArrival, kind: "arrive", stopIndex: i });
      pts.push({ km: s.distanceFromStart, litres: s.fuelOnDeparture, kind: "depart", stopIndex: i });
    });
    pts.push({ km: totalDistance, litres: result.fuelAtDestination, kind: "end" });
    return pts;
  }, [result, totalDistance, startingFuelLitres]);

  // Scales — clamp to avoid divide-by-zero on degenerate inputs.
  const xMax = Math.max(totalDistance, 1);
  const yMax = Math.max(totalCapacity, 1);
  const xScale = (km: number) => PAD_L + (km / xMax) * CHART_W;
  const yScale = (l: number) => PAD_T + CHART_H - (Math.max(0, l) / yMax) * CHART_H;

  const yFull = yScale(totalCapacity);
  const yHalf = yScale(totalCapacity / 2);
  const yReserve = yScale(reserveLitres);
  const yEmpty = yScale(0);

  // Solid path through all measured points.
  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(p.km).toFixed(1)} ${yScale(p.litres).toFixed(1)}`)
    .join(" ");

  // Dashed dest-fill segment: from arrival up to brim. Only when we actually
  // have a destination-fill price to top up at.
  const showDestFill = !!destinationFuel && result.fuelAtDestination < totalCapacity - 0.5;
  const destFillPath = showDestFill
    ? `M ${xScale(totalDistance).toFixed(1)} ${yScale(result.fuelAtDestination).toFixed(1)} L ${xScale(totalDistance).toFixed(1)} ${yFull.toFixed(1)}`
    : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="w-full h-auto select-none"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Fuel level versus distance for the selected strategy"
      >
        {/* Below-reserve danger zone */}
        <rect
          x={PAD_L}
          y={yReserve}
          width={CHART_W}
          height={yEmpty - yReserve}
          fill="rgb(239 68 68 / 0.06)"
        />

        {/* Horizontal gridlines */}
        <line x1={PAD_L} x2={VB_W - PAD_R} y1={yFull} y2={yFull} stroke="#9ca3af" strokeWidth={1} />
        <line x1={PAD_L} x2={VB_W - PAD_R} y1={yHalf} y2={yHalf} stroke="#e5e7eb" strokeDasharray="3 4" strokeWidth={1} />
        <line x1={PAD_L} x2={VB_W - PAD_R} y1={yEmpty} y2={yEmpty} stroke="#9ca3af" strokeWidth={1} />

        {/* Reserve threshold line */}
        <line
          x1={PAD_L}
          x2={VB_W - PAD_R}
          y1={yReserve}
          y2={yReserve}
          stroke="#ef4444"
          strokeDasharray="5 4"
          strokeWidth={1.5}
        />

        {/* Y-axis labels */}
        <text x={PAD_L - 6} y={yFull + 4} textAnchor="end" fontSize={11} fill="#374151">100%</text>
        <text x={PAD_L - 6} y={yHalf + 4} textAnchor="end" fontSize={11} fill="#9ca3af">50%</text>
        <text x={PAD_L - 6} y={yReserve + 4} textAnchor="end" fontSize={11} fill="#ef4444" fontWeight={600}>
          {Math.round((reserveLitres / yMax) * 100)}%
        </text>
        <text x={PAD_L - 6} y={yEmpty + 4} textAnchor="end" fontSize={11} fill="#374151">0%</text>

        {/* X-axis endpoints */}
        <text x={PAD_L} y={VB_H - 8} textAnchor="start" fontSize={11} fill="#6b7280">0 km</text>
        <text x={VB_W - PAD_R} y={VB_H - 8} textAnchor="end" fontSize={11} fill="#6b7280">
          {totalDistance.toFixed(0)} km
        </text>

        {/* Reserve label, right-aligned over its own line */}
        <text
          x={VB_W - PAD_R - 4}
          y={yReserve - 4}
          textAnchor="end"
          fontSize={10}
          fill="#ef4444"
          fontWeight={600}
        >
          reserve
        </text>

        {/* Main fuel-level path */}
        <path d={linePath} fill="none" stroke={color} strokeWidth={2.25} strokeLinejoin="round" />

        {/* Dest-fill dashed segment (reaches brim at the destination) */}
        {destFillPath && (
          <>
            <path
              d={destFillPath}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeDasharray="4 4"
              opacity={0.7}
            />
            <text
              x={xScale(totalDistance) - 6}
              y={(yFull + yScale(result.fuelAtDestination)) / 2 + 3}
              textAnchor="end"
              fontSize={10}
              fill={color}
              fontWeight={600}
            >
              dest fill
            </text>
          </>
        )}

        {/* Endpoint markers (start + arrival) */}
        <circle cx={xScale(0)} cy={yScale(startingFuelLitres)} r={4} fill={color} stroke="white" strokeWidth={2} />
        <circle
          cx={xScale(totalDistance)}
          cy={yScale(showDestFill ? totalCapacity : result.fuelAtDestination)}
          r={4}
          fill={color}
          stroke="white"
          strokeWidth={2}
        />

        {/* Stop markers — invisible hit area + visible arrive+depart dots */}
        {result.stops.map((stop, i) => {
          const x = xScale(stop.distanceFromStart);
          const yA = yScale(stop.fuelOnArrival);
          const yD = yScale(stop.fuelOnDeparture);
          const isSel = selected === i;
          return (
            <g
              key={i}
              onClick={() => setSelected((cur) => (cur === i ? null : i))}
              style={{ cursor: "pointer" }}
            >
              {/* Hit area covers both dots and the vertical fill segment between */}
              <rect
                x={x - 16}
                y={Math.min(yA, yD) - 16}
                width={32}
                height={Math.abs(yA - yD) + 32}
                fill="transparent"
              />
              <circle cx={x} cy={yA} r={isSel ? 6 : 4.5} fill={color} stroke="white" strokeWidth={2} />
              <circle cx={x} cy={yD} r={isSel ? 6 : 4.5} fill={color} stroke="white" strokeWidth={2} />
            </g>
          );
        })}
      </svg>

      {/* Tooltip — positioned in container coordinates so it tracks the SVG
          viewBox even as the SVG scales. */}
      {selected !== null && result.stops[selected] && (() => {
        const stop = result.stops[selected];
        const xPct = (xScale(stop.distanceFromStart) / VB_W) * 100;
        const yPct = (yScale(stop.fuelOnArrival) / VB_H) * 100;
        // Clamp horizontally so the bubble doesn't overflow the card.
        const left = `${Math.max(8, Math.min(92, xPct))}%`;
        const transformX =
          xPct < 12 ? "translateX(0)" :
          xPct > 88 ? "translateX(-100%)" :
          "translateX(-50%)";
        return (
          <div
            className="absolute z-10 pointer-events-none"
            style={{
              left,
              top: `${yPct}%`,
              transform: `${transformX} translateY(calc(-100% - 12px))`,
            }}
          >
            <div className="pointer-events-auto bg-white border border-gray-200 shadow-lg rounded-lg p-2.5 text-xs min-w-[180px] max-w-[240px]">
              <div className="font-bold text-gray-900 leading-tight">{stop.station.name}</div>
              <div className="text-gray-500 mt-0.5">
                {stop.distanceFromStart.toFixed(0)} km · {stop.pricePerLitre.toFixed(1)} c/L
              </div>
              <div className="text-gray-700 mt-1">
                Arrive {stop.fuelOnArrival.toFixed(0)}L · Depart {stop.fuelOnDeparture.toFixed(0)}L
              </div>
              <div className="text-gray-500">
                Add {stop.litresAdded.toFixed(1)}L · ${stop.cost.toFixed(2)}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
