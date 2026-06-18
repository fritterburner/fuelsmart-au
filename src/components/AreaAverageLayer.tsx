"use client";

import { useState, useRef, useEffect } from "react";
import { Circle, Popup, useMapEvents } from "react-leaflet";
import type { Circle as LeafletCircle } from "leaflet";
import { Station, FuelCode } from "@/lib/types";
import PriceHistoryChart from "@/components/PriceHistoryChart";

/**
 * "Tap an area → what's the going rate here." A live, on-the-fly readout over
 * the stations already on the map (no storage, no forecast). Gated behind a
 * toggle so normal map clicks aren't hijacked. Uses pump prices — an objective
 * local market rate, not the viewer's personalised discount price.
 */

const RADIUS_KM = 7;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * 30-day averaged price history for the stations inside the tapped circle.
 * POSTs the in-circle ids to /api/history/area (cheap — same daily snapshots
 * the per-station sparkline reads). Renders "No history yet" until snapshots
 * accrue. Keyed on a sorted-id signature so it only refetches when the set of
 * in-circle stations actually changes.
 */
function AreaHistory({ ids, fuel }: { ids: string[]; fuel: FuelCode }) {
  const [points, setPoints] = useState<{ date: string; value: number | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const idsKey = ids.slice().sort().join(",");

  useEffect(() => {
    let active = true;
    const list = idsKey ? idsKey.split(",") : [];
    async function load() {
      if (list.length === 0) {
        setPoints([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch("/api/history/area", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: list, fuel, days: 30 }),
        });
        const data = await res.json();
        const series = (data.series ?? []) as { date: string; avg: number | null }[];
        if (active) setPoints(series.map((p) => ({ date: p.date, value: p.avg })));
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
  }, [idsKey, fuel]);

  return (
    <div className="mt-2 pt-2 border-t border-gray-200">
      <div className="text-[11px] text-gray-500 mb-1">30-day area average ({fuel})</div>
      {loading ? (
        <div className="text-[11px] text-gray-400 py-2">Loading…</div>
      ) : (
        <PriceHistoryChart series={[{ label: fuel, color: "#0f766e", points }]} height={80} />
      )}
    </div>
  );
}

export default function AreaAverageLayer({
  enabled,
  stations,
  fuel,
}: {
  enabled: boolean;
  stations: Station[];
  fuel: FuelCode;
}) {
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
  const circleRef = useRef<LeafletCircle | null>(null);

  useMapEvents({
    click(e) {
      if (!enabled) return;
      setPoint({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });

  // Open the readout immediately on tap — otherwise the popup only shows on a
  // second click of the circle.
  useEffect(() => {
    if (point && circleRef.current) circleRef.current.openPopup();
  }, [point]);

  if (!enabled || !point) return null;

  const prices: number[] = [];
  const inIds: string[] = [];
  for (const s of stations) {
    const p = s.prices.find((pr) => pr.fuel === fuel)?.price;
    if (p == null) continue;
    if (haversineKm(point.lat, point.lng, s.lat, s.lng) <= RADIUS_KM) {
      prices.push(p);
      inIds.push(s.id);
    }
  }
  const count = prices.length;
  const avg = count ? Math.round((prices.reduce((a, b) => a + b, 0) / count) * 10) / 10 : null;
  const min = count ? Math.min(...prices) : null;

  return (
    <Circle
      ref={circleRef}
      eventHandlers={{ click: (e) => setPoint({ lat: e.latlng.lat, lng: e.latlng.lng }) }}
      center={[point.lat, point.lng]}
      radius={RADIUS_KM * 1000}
      pathOptions={{ color: "#0f766e", weight: 1, fillColor: "#0f766e", fillOpacity: 0.08 }}
    >
      <Popup>
        <div className="text-sm">
          <strong>Within {RADIUS_KM} km</strong>
          {count === 0 ? (
            <div className="text-xs text-gray-600 mt-1">No {fuel} prices in this area.</div>
          ) : (
            <div className="mt-1 space-y-0.5">
              <div>
                Average {fuel}: <strong>{avg} c/L</strong>
              </div>
              <div>
                Cheapest: <strong>{min} c/L</strong>{" "}
                <span className="text-gray-500">({count} station{count === 1 ? "" : "s"})</span>
              </div>
            </div>
          )}
          {count > 0 && <AreaHistory ids={inIds} fuel={fuel} />}
          <div className="text-[11px] text-gray-400 mt-1">Tap elsewhere to move the area.</div>
        </div>
      </Popup>
    </Circle>
  );
}
