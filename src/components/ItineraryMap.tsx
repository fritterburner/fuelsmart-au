"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import type { TripStop } from "@/lib/types";
import type { ItineraryStop } from "@/lib/itinerary";
import "leaflet/dist/leaflet.css";

function stopIcon(n: number, kind: "start" | "end" | "mid"): L.DivIcon {
  const bg = kind === "mid" ? "#1e293b" : "#0f766e";
  return L.divIcon({
    className: "itin-stop",
    html: `<div style="background:${bg};width:26px;height:26px;border-radius:13px;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;color:white;font-size:12px;font-weight:700;">${n}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function fillIcon(litres: number): L.DivIcon {
  const label = `⛽ ${litres.toFixed(0)}L`;
  const width = Math.max(44, label.length * 7 + 10);
  return L.divIcon({
    className: "itin-fill",
    html: `<div style="background:#16a34a;min-width:${width}px;height:22px;border-radius:11px;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:700;padding:0 5px;white-space:nowrap;">${label}</div>`,
    iconSize: [width, 22],
    iconAnchor: [width / 2, 11],
  });
}

/** Re-fit the view whenever the route (or, before routing, the stop set) changes. */
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    const b = L.latLngBounds(points.map(([lat, lng]) => [lat, lng]));
    map.fitBounds(b, { padding: [24, 24] });
    // A map inside a freshly laid-out card can measure 0×0 on first paint.
    const t = setTimeout(() => map.invalidateSize(), 50);
    return () => clearTimeout(t);
  }, [map, points]);
  return null;
}

interface Props {
  stops: ItineraryStop[];
  geometry: [number, number][] | null;
  fills?: TripStop[];
  /** Shown while a fresh route is being fetched. */
  routing?: boolean;
}

export default function ItineraryMap({ stops, geometry, fills = [], routing = false }: Props) {
  const fitPoints: [number, number][] =
    geometry && geometry.length > 1 ? geometry : stops.map((s) => [s.lat, s.lng]);

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={[-20, 140]}
        zoom={5}
        className="h-full w-full"
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={fitPoints} />
        {geometry && geometry.length > 1 ? (
          <Polyline positions={geometry} color="#0f766e" weight={4} opacity={0.85} />
        ) : (
          // No route yet (or offline on first visit): straight dashed connectors so the order still reads.
          <Polyline
            positions={stops.map((s) => [s.lat, s.lng] as [number, number])}
            color="#94a3b8"
            weight={2}
            dashArray="6 8"
          />
        )}
        {stops.map((s, i) => (
          <Marker
            key={`${s.lat},${s.lng},${i}`}
            position={[s.lat, s.lng]}
            icon={stopIcon(i + 1, i === 0 ? "start" : i === stops.length - 1 ? "end" : "mid")}
            zIndexOffset={500}
          >
            <Popup>
              <div className="text-sm">
                <strong>{i + 1}. {s.label}</strong>
                {s.nights > 0 && <div className="text-gray-500">{s.nights} night{s.nights === 1 ? "" : "s"}</div>}
              </div>
            </Popup>
          </Marker>
        ))}
        {fills.map((f) => (
          <Marker
            key={`fill-${f.station.id}-${f.distanceFromStart.toFixed(0)}`}
            position={[f.station.lat, f.station.lng]}
            icon={fillIcon(f.litresAdded)}
            zIndexOffset={800}
          >
            <Popup>
              <div className="text-sm">
                <strong>{f.station.name}</strong>
                <div className="text-gray-500">{f.station.address}{f.station.suburb ? `, ${f.station.suburb}` : ""}</div>
                <div>
                  {f.pricePerLitre.toFixed(1)} c/L{f.fallbackFuel ? ` (${f.fallbackFuel})` : ""} · add {f.litresAdded.toFixed(1)} L · ${f.cost.toFixed(2)}
                </div>
                <div className="text-gray-500">
                  {f.distanceFromStart.toFixed(0)} km from start · arrive {f.fuelOnArrival.toFixed(0)} L → depart {f.fuelOnDeparture.toFixed(0)} L
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {routing && (
        <div className="absolute top-2 right-2 z-[1000] rounded-full bg-white/90 border px-2.5 py-1 text-xs text-gray-700 shadow">
          Routing…
        </div>
      )}
    </div>
  );
}
