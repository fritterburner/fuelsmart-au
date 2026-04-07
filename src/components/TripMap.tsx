"use client";

import { MapContainer, TileLayer, Polyline, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { TripPlan } from "@/lib/types";
import "leaflet/dist/leaflet.css";

const stopIcon = L.divIcon({
  className: "trip-stop",
  html: '<div style="background:#22c55e;width:16px;height:16px;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

export default function TripMap({ plan }: { plan: TripPlan }) {
  const bounds = L.latLngBounds(plan.routeGeometry.map(([lat, lng]) => [lat, lng]));

  return (
    <MapContainer bounds={bounds} className="h-full w-full" scrollWheelZoom={true}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Polyline positions={plan.routeGeometry} color="#3b82f6" weight={4} />
      {plan.stops.map((stop, i) => (
        <Marker key={i} position={[stop.station.lat, stop.station.lng]} icon={stopIcon}>
          <Popup>
            <strong>{stop.station.name}</strong><br />
            {stop.pricePerLitre.toFixed(1)} c/L &middot; Add {stop.litresAdded.toFixed(1)}L &middot; ${stop.cost.toFixed(2)}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
