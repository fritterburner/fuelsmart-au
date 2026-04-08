"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import { Station, FuelCode } from "@/lib/types";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default marker icons in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function getPriceColor(price: number, min: number, max: number): string {
  if (max === min) return "#f59e0b"; // yellow if all same price
  const ratio = (price - min) / (max - min);
  if (ratio <= 0.2) return "#22c55e"; // green — cheapest 20%
  if (ratio >= 0.8) return "#ef4444"; // red — most expensive 20%
  return "#f59e0b"; // yellow — middle
}

function createPriceIcon(price: number, color: string): L.DivIcon {
  return L.divIcon({
    className: "price-marker",
    html: `<div style="background:${color};color:white;padding:2px 6px;border-radius:4px;font-size:12px;font-weight:bold;white-space:nowrap;border:1px solid rgba(0,0,0,0.2);text-align:center;">${price.toFixed(1)}</div>`,
    iconSize: [60, 24],
    iconAnchor: [30, 12],
  });
}

function getBoundsString(map: L.Map): string {
  const b = map.getBounds();
  return `${b.getSouth()},${b.getWest()},${b.getNorth()},${b.getEast()}`;
}

function MapController({
  onBoundsChange,
  fuel,
}: {
  onBoundsChange: (bounds: string) => void;
  fuel: FuelCode;
}) {
  const map = useMap();
  const lastFuel = useRef(fuel);

  // Fetch on map move
  useMapEvents({
    moveend: () => onBoundsChange(getBoundsString(map)),
  });

  // Fetch on initial mount
  useEffect(() => {
    const timer = setTimeout(() => onBoundsChange(getBoundsString(map)), 200);
    return () => clearTimeout(timer);
  }, [map, onBoundsChange]);

  // Re-fetch when fuel type changes
  useEffect(() => {
    if (lastFuel.current !== fuel) {
      lastFuel.current = fuel;
      onBoundsChange(getBoundsString(map));
    }
  }, [fuel, map, onBoundsChange]);

  return null;
}

export function FlyTo({ center }: { center: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, 13);
  }, [center, map]);
  return null;
}

interface Props {
  fuel: FuelCode;
  flyTo: [number, number] | null;
}

export default function MapView({ fuel, flyTo }: Props) {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeFuel, setActiveFuel] = useState<FuelCode>(fuel);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);
  const fetchController = useRef<AbortController | null>(null);

  const fetchStations = useCallback(
    async (bounds: string) => {
      // Cancel any in-flight request
      if (fetchController.current) fetchController.current.abort();
      const controller = new AbortController();
      fetchController.current = controller;

      setLoading(true);
      try {
        const resp = await fetch(`/api/stations?bounds=${bounds}&fuel=${fuel}`, {
          signal: controller.signal,
        });
        const data = await resp.json();
        setStations(data.stations || []);
        setActiveFuel(data.activeFuel || fuel);
        setFallbackNotice(data.fallbackNotice || null);
      } catch (e: any) {
        if (e.name !== "AbortError") console.error("Failed to fetch stations:", e);
      }
      setLoading(false);
    },
    [fuel]
  );

  // Compute price range for colour coding (using activeFuel, which may be a fallback)
  const displayFuel = activeFuel;
  const prices = stations
    .map((s) => s.prices.find((p) => p.fuel === displayFuel)?.price)
    .filter(Boolean) as number[];
  const minPrice = Math.min(...prices, Infinity);
  const maxPrice = Math.max(...prices, -Infinity);

  // Default center: Darwin
  const defaultCenter: [number, number] = [-12.46, 130.84];

  return (
    <MapContainer center={defaultCenter} zoom={12} className="h-full w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapController onBoundsChange={fetchStations} fuel={fuel} />
      <FlyTo center={flyTo} />
      {stations.map((station) => {
        const priceEntry = station.prices.find((p) => p.fuel === displayFuel);
        if (!priceEntry) return null;
        const color = getPriceColor(priceEntry.price, minPrice, maxPrice);
        const icon = createPriceIcon(priceEntry.price, color);

        return (
          <Marker key={station.id} position={[station.lat, station.lng]} icon={icon}>
            <Popup>
              <div className="text-sm">
                <strong>{station.name}</strong>
                <br />
                {station.address}, {station.suburb} {station.state} {station.postcode}
                <hr className="my-1" />
                {station.prices.map((p) => (
                  <div key={p.fuel} className="flex justify-between gap-4">
                    <span>{p.fuel}</span>
                    <strong>{p.price.toFixed(1)} c/L</strong>
                  </div>
                ))}
                <div className="text-xs text-gray-500 mt-1">
                  Updated: {new Date(priceEntry.updated).toLocaleDateString()}
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
      {/* Fallback fuel notice banner */}
      {fallbackNotice && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[1000] bg-amber-500 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium max-w-md text-center">
          {fallbackNotice}
        </div>
      )}
      {loading && !fallbackNotice && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[1000] bg-white px-3 py-1 rounded shadow text-sm">
          Loading...
        </div>
      )}
    </MapContainer>
  );
}
