"use client";

import { useState, useRef, useEffect } from "react";
import { Circle, Popup, useMapEvents } from "react-leaflet";
import type { Circle as LeafletCircle } from "leaflet";
import { Station, FuelCode } from "@/lib/types";

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
  for (const s of stations) {
    const p = s.prices.find((pr) => pr.fuel === fuel)?.price;
    if (p == null) continue;
    if (haversineKm(point.lat, point.lng, s.lat, s.lng) <= RADIUS_KM) prices.push(p);
  }
  const count = prices.length;
  const avg = count ? Math.round((prices.reduce((a, b) => a + b, 0) / count) * 10) / 10 : null;
  const min = count ? Math.min(...prices) : null;

  return (
    <Circle
      ref={circleRef}
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
          <div className="text-[11px] text-gray-400 mt-1">Tap elsewhere to move the area.</div>
        </div>
      </Popup>
    </Circle>
  );
}
