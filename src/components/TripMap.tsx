"use client";

import { MapContainer, TileLayer, Polyline, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { TripComparison, TripStrategy, TripStop } from "@/lib/types";
import "leaflet/dist/leaflet.css";

const STRATEGY_COLORS: Record<TripStrategy, string> = {
  optimised: "#22c55e",
  cheapest_fill: "#3b82f6",
  no_planning: "#f97316",
};

function makeStopIcon(color: string, index: number): L.DivIcon {
  return L.divIcon({
    className: "trip-stop",
    html: `<div style="background:${color};width:24px;height:24px;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:bold;">${index + 1}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

interface Props {
  comparison: TripComparison;
  selectedStrategy: TripStrategy;
}

export default function TripMap({ comparison, selectedStrategy }: Props) {
  const bounds = L.latLngBounds(
    comparison.routeGeometry.map(([lat, lng]) => [lat, lng])
  );

  const selected = comparison.strategies.find((s) => s.strategy === selectedStrategy)!;
  const color = STRATEGY_COLORS[selectedStrategy];

  return (
    <MapContainer bounds={bounds} className="h-full w-full" scrollWheelZoom={true}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Polyline positions={comparison.routeGeometry} color="#64748b" weight={3} opacity={0.5} />
      {selected.stops.map((stop, i) => (
        <Marker
          key={`${selectedStrategy}-${i}`}
          position={[stop.station.lat, stop.station.lng]}
          icon={makeStopIcon(color, i)}
        >
          <Popup>
            <div className="text-sm">
              <strong>Stop {i + 1}: {stop.station.name}</strong>
              <br />
              {stop.pricePerLitre.toFixed(1)} c/L &middot; Add {stop.litresAdded.toFixed(1)}L &middot; ${stop.cost.toFixed(2)}
              <br />
              <span className="text-gray-500">
                Arrive: {stop.fuelOnArrival.toFixed(0)}L &rarr; Depart: {stop.fuelOnDeparture.toFixed(0)}L
              </span>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
