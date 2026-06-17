"use client";

import { useEffect, useState } from "react";
import { FuelCode } from "@/lib/types";
import PriceHistoryChart from "@/components/PriceHistoryChart";

/**
 * Compact 30-day price history for a single station, shown inside the map popup.
 * Reads /api/history/station/[id]; renders "No history yet" until snapshots
 * accrue (per-station history is kept ~35 days).
 */
export default function StationSparkline({
  stationId,
  fuel,
}: {
  stationId: string;
  fuel: FuelCode;
}) {
  const [points, setPoints] = useState<{ date: string; value: number | null }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/history/station/${encodeURIComponent(stationId)}?fuel=${fuel}&days=30`,
        );
        const data = await res.json();
        const series = (data.series ?? []) as { date: string; price: number | null }[];
        if (active) setPoints(series.map((p) => ({ date: p.date, value: p.price })));
      } catch {
        if (active) setPoints([]);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [stationId, fuel]);

  return (
    <div className="mt-2 pt-2 border-t border-gray-200">
      <div className="text-[11px] text-gray-500 mb-1">30-day {fuel} trend</div>
      {loading ? (
        <div className="text-[11px] text-gray-400 py-2">Loading…</div>
      ) : (
        <PriceHistoryChart
          series={[{ label: fuel, color: "#0f766e", points }]}
          height={90}
        />
      )}
    </div>
  );
}
