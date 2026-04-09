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

function makeStopIcon(color: string, label: string): L.DivIcon {
  // Wider bubble for multi-stop labels like "1, 5"
  const isMulti = label.includes(",");
  const width = isMulti ? Math.max(32, label.length * 8 + 12) : 24;
  const fontSize = isMulti ? 10 : 11;
  return L.divIcon({
    className: "trip-stop",
    html: `<div style="background:${color};min-width:${width}px;height:24px;border-radius:12px;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:white;font-size:${fontSize}px;font-weight:bold;padding:0 4px;white-space:nowrap;">${label}</div>`,
    iconSize: [width, 24],
    iconAnchor: [width / 2, 12],
  });
}

// Group stops that share the same station location
interface StopGroup {
  station: TripStop["station"];
  stops: { index: number; stop: TripStop }[];
}

function groupStopsByLocation(stops: TripStop[]): StopGroup[] {
  const groups: StopGroup[] = [];
  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];
    // Check if this station is already in a group (same lat/lng within ~100m)
    const existing = groups.find(
      (g) =>
        Math.abs(g.station.lat - stop.station.lat) < 0.001 &&
        Math.abs(g.station.lng - stop.station.lng) < 0.001
    );
    if (existing) {
      existing.stops.push({ index: i, stop });
    } else {
      groups.push({
        station: stop.station,
        stops: [{ index: i, stop }],
      });
    }
  }
  return groups;
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
  const groups = groupStopsByLocation(selected.stops);

  return (
    <MapContainer bounds={bounds} className="h-full w-full" scrollWheelZoom={true}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Polyline positions={comparison.routeGeometry} color="#64748b" weight={3} opacity={0.5} />
      {groups.map((group) => {
        const label = group.stops.map((s) => s.index + 1).join(", ");
        return (
          <Marker
            key={`${selectedStrategy}-${label}`}
            position={[group.station.lat, group.station.lng]}
            icon={makeStopIcon(color, label)}
          >
            <Popup>
              <div className="text-sm space-y-2">
                {group.stops.map(({ index, stop }) => {
                  const prevKm = index === 0 ? 0 : selected.stops[index - 1].distanceFromStart;
                  const legDistance = stop.distanceFromStart - prevKm;
                  return (
                    <div key={index}>
                      <strong>Stop {index + 1}: {stop.station.name}</strong>
                      <br />
                      <span className="text-gray-500">
                        {legDistance.toFixed(0)} km from {index === 0 ? "start" : `stop ${index}`}
                      </span>
                      <br />
                      {stop.pricePerLitre.toFixed(1)} c/L{stop.fallbackFuel ? ` (${stop.fallbackFuel})` : ""} &middot; Add {stop.litresAdded.toFixed(1)}L &middot; ${stop.cost.toFixed(2)}
                      <br />
                      <span className="text-gray-500">
                        Arrive with {stop.fuelOnArrival.toFixed(0)}L &rarr; Depart with {stop.fuelOnDeparture.toFixed(0)}L
                      </span>
                    </div>
                  );
                })}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
