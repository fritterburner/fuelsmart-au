"use client";

import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Popup,
  useMapEvents,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Match the default icon setup MapView uses.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function pinIcon(label: string, color: string): L.DivIcon {
  return L.divIcon({
    className: "fill-up-pin",
    html: `<div style="background:${color};color:white;width:32px;height:32px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:14px;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.35);">
      <span style="transform:rotate(45deg);">${label}</span>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 30],
  });
}

function stationIcon(price: number, isWinner: boolean): L.DivIcon {
  const bg = isWinner ? "#10b981" : "#64748b";
  const ring = isWinner ? "border:3px solid #047857;" : "border:1px solid rgba(0,0,0,0.2);";
  return L.divIcon({
    className: "fill-up-station",
    html: `<div style="background:${bg};${ring}color:white;padding:3px 8px;border-radius:6px;font-size:12px;font-weight:bold;white-space:nowrap;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.35);">${price.toFixed(1)}</div>`,
    iconSize: [60, 26],
    iconAnchor: [30, 13],
  });
}

const MAP_POS_KEY = "fuelsmart-mappos";

function loadMapPosition(): { lat: number; lng: number; zoom: number } | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(MAP_POS_KEY);
  if (!stored) return null;
  try {
    const pos = JSON.parse(stored);
    if (
      typeof pos.lat === "number" &&
      typeof pos.lng === "number" &&
      typeof pos.zoom === "number"
    ) {
      return pos;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function ClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => onClick(e.latlng.lat, e.latlng.lng),
  });
  return null;
}

/**
 * Keep the map in view of any pins / shortlist once they're set.
 */
function FitBounds({
  points,
}: {
  points: Array<[number, number]>;
}) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], Math.max(map.getZoom(), 12));
      return;
    }
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, points]);
  return null;
}

export interface FillUpShortlistPin {
  lat: number;
  lng: number;
  price: number;
  name: string;
  suburb: string;
}

interface Props {
  onPointClick: (lat: number, lng: number) => void;
  a: { lat: number; lng: number } | null;
  b: { lat: number; lng: number } | null;
  winner: FillUpShortlistPin | null;
  shortlist: FillUpShortlistPin[];
  /** Winner's via-route geometry (already in [lat,lng] order). */
  routeGeometry: [number, number][] | null;
}

export default function FillUpMap({
  onPointClick,
  a,
  b,
  winner,
  shortlist,
  routeGeometry,
}: Props) {
  const saved = loadMapPosition();
  const initialCenter: [number, number] = saved ? [saved.lat, saved.lng] : [-25.5, 134.5];
  const initialZoom = saved ? saved.zoom : 5;

  const pinPoints: Array<[number, number]> = [];
  if (a) pinPoints.push([a.lat, a.lng]);
  if (b) pinPoints.push([b.lat, b.lng]);
  if (winner) pinPoints.push([winner.lat, winner.lng]);

  return (
    <MapContainer center={initialCenter} zoom={initialZoom} className="h-full w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onClick={onPointClick} />
      <FitBounds points={pinPoints} />

      {a && (
        <Marker position={[a.lat, a.lng]} icon={pinIcon("A", "#10b981")}>
          <Popup>Start (A)</Popup>
        </Marker>
      )}
      {b && (
        <Marker position={[b.lat, b.lng]} icon={pinIcon("B", "#ef4444")}>
          <Popup>Destination (B)</Popup>
        </Marker>
      )}

      {routeGeometry && routeGeometry.length > 0 && (
        <Polyline positions={routeGeometry} pathOptions={{ color: "#10b981", weight: 4, opacity: 0.75 }} />
      )}

      {winner && (
        <Marker
          position={[winner.lat, winner.lng]}
          icon={stationIcon(winner.price, true)}
          zIndexOffset={1000}
        >
          <Popup>
            <div className="text-sm">
              <strong>{winner.name}</strong>
              <div className="text-xs text-gray-600">{winner.suburb}</div>
              <div className="mt-1 text-emerald-700 font-bold">
                {winner.price.toFixed(1)} c/L — best stop
              </div>
            </div>
          </Popup>
        </Marker>
      )}

      {shortlist.map((s) => (
        <Marker
          key={`${s.lat},${s.lng}`}
          position={[s.lat, s.lng]}
          icon={stationIcon(s.price, false)}
        >
          <Popup>
            <div className="text-sm">
              <strong>{s.name}</strong>
              <div className="text-xs text-gray-600">{s.suburb}</div>
              <div className="mt-1">{s.price.toFixed(1)} c/L</div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
