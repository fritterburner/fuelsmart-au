"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import { Station, FuelCode } from "@/lib/types";
import { nearestBaseline } from "@/lib/excise/nearest-baseline";
import { calcVerdict } from "@/lib/excise/calc";
import { toFuelBucket } from "@/lib/excise/fuel-buckets";
import type { Verdict, MarketData } from "@/lib/excise/types";
import { assignRankColors } from "@/lib/rank-palette";
import { formatAge } from "@/lib/time-format";
import { applyToStation } from "@/lib/discounts";
import type { Discount } from "@/lib/discounts";
import { useDiscounts, loadDiscounts, saveDiscounts } from "@/lib/useDiscounts";
import StationExcisePopup from "./StationExcisePopup";
import StationNavLinks from "./StationNavLinks";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default marker icons in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Default-mode palette is now rank-based — see `@/lib/rank-palette`.

const EXCISE_VERDICT_COLOR: Record<Verdict, string> = {
  full: "#059669",        // emerald-600 — full pass-through
  partial: "#f59e0b",     // amber-500 — partial
  none: "#dc2626",        // red-600 — not passed through
  "price-rose": "#2563eb",// blue-600 — price moved above baseline
  na: "#6b7280",          // gray-500 — fuel not excise-applicable
};

function createPriceIcon(price: number, color: string): L.DivIcon {
  return L.divIcon({
    className: "price-marker",
    html: `<div style="background:${color};color:white;padding:2px 6px;border-radius:4px;font-size:12px;font-weight:bold;white-space:nowrap;border:1px solid rgba(0,0,0,0.2);text-align:center;">${price.toFixed(1)}</div>`,
    iconSize: [60, 24],
    iconAnchor: [30, 12],
  });
}

function createExciseIcon(label: string, color: string): L.DivIcon {
  return L.divIcon({
    className: "price-marker",
    html: `<div style="background:${color};color:white;padding:2px 6px;border-radius:4px;font-size:12px;font-weight:bold;white-space:nowrap;border:1px solid rgba(0,0,0,0.2);text-align:center;">${label}</div>`,
    iconSize: [60, 24],
    iconAnchor: [30, 12],
  });
}

function getBoundsString(map: L.Map): string {
  const b = map.getBounds();
  return `${b.getSouth()},${b.getWest()},${b.getNorth()},${b.getEast()}`;
}

const MAP_POS_KEY = "fuelsmart-mappos";

function saveMapPosition(map: L.Map) {
  const c = map.getCenter();
  const z = map.getZoom();
  localStorage.setItem(MAP_POS_KEY, JSON.stringify({ lat: c.lat, lng: c.lng, zoom: z }));
}

function loadMapPosition(): { lat: number; lng: number; zoom: number } | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(MAP_POS_KEY);
  if (!stored) return null;
  try {
    const pos = JSON.parse(stored);
    if (typeof pos.lat === "number" && typeof pos.lng === "number" && typeof pos.zoom === "number") {
      return pos;
    }
  } catch { /* ignore */ }
  return null;
}

function MapController({
  onBoundsChange,
  onCenterChange,
  fuel,
}: {
  onBoundsChange: (bounds: string) => void;
  onCenterChange: (lat: number, lng: number) => void;
  fuel: FuelCode;
}) {
  const map = useMap();
  const lastFuel = useRef(fuel);
  const geolocated = useRef(false);

  // Fetch on map move + persist position
  useMapEvents({
    moveend: () => {
      saveMapPosition(map);
      onBoundsChange(getBoundsString(map));
      const c = map.getCenter();
      onCenterChange(c.lat, c.lng);
    },
  });

  // On mount: try geolocation if no saved position
  useEffect(() => {
    if (geolocated.current) return;
    geolocated.current = true;

    const saved = loadMapPosition();
    if (saved) {
      // Already positioned from saved state (MapContainer initial center)
      // Just trigger station fetch
      const timer = setTimeout(() => onBoundsChange(getBoundsString(map)), 200);
      return () => clearTimeout(timer);
    }

    // No saved position — try browser geolocation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          map.setView([pos.coords.latitude, pos.coords.longitude], 12);
          // moveend handler will save + fetch
        },
        () => {
          // Denied or unavailable — stay at fallback, just fetch
          onBoundsChange(getBoundsString(map));
        },
        { timeout: 5000 }
      );
    } else {
      onBoundsChange(getBoundsString(map));
    }
  }, [map, onBoundsChange]);

  // Fetch on initial mount (for saved-position case where geolocation doesn't fire)
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
  exciseMode?: boolean;
  marketData?: MarketData | null;
  marketOverride?: { brent_usd: number; aud_usd: number } | null;
  /** Default-mode palette: number of cheapest visible stations to highlight green. */
  cheapestHighlightCount?: number;
}

function StationPricePopupContent({
  station,
  priceEntry,
  activeDiscounts,
}: {
  station: Station;
  priceEntry: { fuel: FuelCode; price: number; updated: string };
  activeDiscounts: Discount[];
}) {
  const [editing, setEditing] = useState(false);
  const [cplOff, setCplOff] = useState<string>("4");
  const [label, setLabel] = useState<string>("");

  const existingOverride = activeDiscounts.find(
    (d) => d.stationIds && d.stationIds.includes(station.id),
  );

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(cplOff);
    if (!Number.isFinite(value) || value <= 0) return;
    const current = loadDiscounts();
    const trimmedLabel = label.trim();
    const next: Discount = {
      id: "d-" + Math.random().toString(36).slice(2, 9),
      name: trimmedLabel ? `${station.name} — ${trimmedLabel}` : `${station.name} — override`,
      type: "fixed_cpl",
      value,
      appliesTo: "both",
      enabled: true,
      brands: [],
      states: [],
      stationIds: [station.id],
    };
    saveDiscounts([...current, next]);
    setEditing(false);
    setLabel("");
  }

  function handleRemove() {
    if (!existingOverride) return;
    if (!window.confirm("Remove the saved override for this station?")) return;
    const current = loadDiscounts();
    saveDiscounts(current.filter((d) => d.id !== existingOverride.id));
  }

  return (
    <div className="text-sm">
      <strong>{station.name}</strong>
      <br />
      {station.address}, {station.suburb} {station.state} {station.postcode}
      <hr className="my-1" />
      {station.prices.map((p) => {
        const eff = applyToStation(station, p.price, activeDiscounts);
        const hasDiscount = eff.applied.length > 0;
        return (
          <div key={p.fuel} className="flex justify-between items-start gap-4">
            <span>{p.fuel}</span>
            <span className="text-right">
              <strong>{eff.effectiveCpl.toFixed(1)} c/L</strong>
              {hasDiscount && (
                <span
                  className="block text-[11px] text-gray-500 line-through"
                  aria-label={`Rack price ${p.price.toFixed(1)} cents per litre`}
                >
                  {p.price.toFixed(1)}
                </span>
              )}
            </span>
          </div>
        );
      })}
      <div className="text-xs text-gray-500 mt-1">
        Updated {formatAge(priceEntry.updated)}
        {activeDiscounts.some((d) => d.enabled) && (
          <span className="block text-[11px] text-emerald-700">
            Showing price after your saved discounts.{" "}
            <a href="/discounts" className="underline">
              Change
            </a>
          </span>
        )}
      </div>

      {/* Station-specific override controls */}
      <div className="mt-2 pt-2 border-t border-gray-200">
        {existingOverride ? (
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="text-emerald-700">
              Override: {existingOverride.value} c/L off
            </span>
            <button
              type="button"
              onClick={handleRemove}
              className="text-red-600 underline"
            >
              Remove
            </button>
          </div>
        ) : editing ? (
          <form onSubmit={handleSave} className="space-y-1">
            <label className="block text-[11px] text-gray-700">
              c/L off at this servo
              <input
                type="number"
                min={0}
                step={0.1}
                value={cplOff}
                onChange={(e) => setCplOff(e.target.value)}
                className="block w-20 mt-0.5 px-1.5 py-1 border border-gray-300 rounded font-mono"
                autoFocus
              />
            </label>
            <label className="block text-[11px] text-gray-700">
              Label (optional)
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="mate's rates"
                className="block w-full mt-0.5 px-1.5 py-1 border border-gray-300 rounded"
              />
            </label>
            <div className="flex gap-2 pt-0.5">
              <button
                type="submit"
                className="px-2 py-1 text-[11px] bg-emerald-600 text-white rounded hover:bg-emerald-700"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="px-2 py-1 text-[11px] text-gray-600 hover:bg-gray-100 rounded"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-[11px] text-emerald-700 underline"
          >
            + Adjust this station&apos;s price
          </button>
        )}
      </div>

      <StationNavLinks lat={station.lat} lng={station.lng} name={station.name} />
    </div>
  );
}

export default function MapView({
  fuel,
  flyTo,
  exciseMode = false,
  marketData = null,
  marketOverride = null,
  cheapestHighlightCount = 3,
}: Props) {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeFuel, setActiveFuel] = useState<FuelCode>(fuel);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const fetchController = useRef<AbortController | null>(null);
  const { discounts: activeDiscounts } = useDiscounts();

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

  // Compute rank-based colour for each station with a price. We build a
  // Map<stationId, color> in the same pass to avoid an O(n²) lookup below.
  const displayFuel = activeFuel;
  const pricedStations = stations
    .map((s) => {
      const p = s.prices.find((pr) => pr.fuel === displayFuel)?.price;
      return p != null ? { id: s.id, price: p } : null;
    })
    .filter((x): x is { id: string; price: number } => x != null);
  const rankColors = assignRankColors(
    pricedStations.map((s) => s.price),
    cheapestHighlightCount,
  );
  const colorById = new Map<string, string>();
  pricedStations.forEach((s, i) => colorById.set(s.id, rankColors[i]));

  // Use saved map position, or fall back to a broad Australia view
  const saved = loadMapPosition();
  const initialCenter: [number, number] = saved ? [saved.lat, saved.lng] : [-25.5, 134.5];
  const initialZoom = saved ? saved.zoom : 5;

  return (
    <MapContainer center={initialCenter} zoom={initialZoom} className="h-full w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapController
        onBoundsChange={fetchStations}
        onCenterChange={(lat, lng) => setMapCenter({ lat, lng })}
        fuel={fuel}
      />
      <FlyTo center={flyTo} />
      {stations.map((station) => {
        const priceEntry = station.prices.find((p) => p.fuel === displayFuel);
        if (!priceEntry) return null;

        // Excise mode: recolour pins by pass-through verdict (if market data available).
        const effectiveMarket = marketOverride ?? marketData;
        if (exciseMode && effectiveMarket) {
          const bucket = toFuelBucket(displayFuel);
          if (bucket === "NA") {
            const icon = createExciseIcon(priceEntry.price.toFixed(1), EXCISE_VERDICT_COLOR.na);
            return (
              <Marker key={station.id} position={[station.lat, station.lng]} icon={icon}>
                <Popup>
                  <div className="text-sm">
                    <strong>{station.name}</strong>
                    <div className="text-xs text-gray-600 mt-1">
                      {displayFuel} is not subject to the federal excise cut — no verdict available.
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          }

          const nearest = nearestBaseline(station.lat, station.lng);
          const verdict = calcVerdict({
            pumpPriceCpl: priceEntry.price,
            fuel: bucket,
            baseline: nearest.city,
            liveOilUsd: effectiveMarket.brent_usd,
            liveAudUsd: effectiveMarket.aud_usd,
          });

          const color = EXCISE_VERDICT_COLOR[verdict.verdict];
          // Show pass-through % as the label (or price if price-rose / na).
          const label =
            verdict.verdict === "price-rose" || verdict.verdict === "na"
              ? priceEntry.price.toFixed(1)
              : `${Math.round(Math.max(0, Math.min(100, verdict.passthroughPct)))}%`;
          const icon = createExciseIcon(label, color);

          return (
            <Marker key={station.id} position={[station.lat, station.lng]} icon={icon}>
              <Popup>
                <StationExcisePopup
                  station={station}
                  displayFuel={displayFuel}
                  pumpPriceCpl={priceEntry.price}
                  pumpPriceUpdated={priceEntry.updated}
                  verdict={verdict}
                  nearest={nearest}
                />
              </Popup>
            </Marker>
          );
        }

        // Default: rank-based colouring (cheapest N green, tail red/orange, middle gray).
        const color = colorById.get(station.id) ?? "#6b7280";
        const icon = createPriceIcon(priceEntry.price, color);

        return (
          <Marker key={station.id} position={[station.lat, station.lng]} icon={icon}>
            <Popup>
              <StationPricePopupContent
                station={station}
                priceEntry={priceEntry}
                activeDiscounts={activeDiscounts}
              />
            </Popup>
          </Marker>
        );
      })}
      {/* Top-stacked notices: fuel fallback, loading */}
      <div
        className="absolute top-2 left-1/2 -translate-x-1/2 z-[1000] flex flex-col gap-2 items-center w-[calc(100%-1rem)] max-w-md"
        aria-live="polite"
      >
        {fallbackNotice && (
          <div
            role="status"
            className="bg-amber-500 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium text-center"
          >
            {fallbackNotice}
          </div>
        )}
        {loading && !fallbackNotice && (
          <div className="bg-white px-3 py-1 rounded shadow text-sm">
            Loading...
          </div>
        )}
      </div>
      {/* End top-stacked notices */}
    </MapContainer>
  );
}
