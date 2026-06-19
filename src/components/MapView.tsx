"use client";

import { useEffect, useState, useCallback, useRef, type RefObject } from "react";
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
import StationSparkline from "./StationSparkline";
import AreaAverageLayer from "./AreaAverageLayer";
import SaObligations from "./SaObligations";
import FreshnessChip from "./FreshnessChip";
import { useIsDarkTheme } from "@/lib/useIsDarkTheme";
import "leaflet/dist/leaflet.css";
import MarkerClusterGroup from "react-leaflet-cluster";
import "leaflet.markercluster/dist/MarkerCluster.css";

// Fix Leaflet default marker icons in Next.js
delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
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

function createPriceIcon(price: number, color: string, discounted: boolean = false): L.DivIcon {
  // Rank colour = price tier; a red ring marks "your saved discount applies here".
  const ring = discounted ? "0 0 0 2px #dc2626," : "";
  return L.divIcon({
    className: "price-marker",
    html: `<div style="display:flex;align-items:center;justify-content:center;width:62px;height:26px;"><span style="background:${color};color:#fff;padding:3px 8px;border-radius:9px;font:600 12px/1.1 -apple-system,system-ui,'Segoe UI',sans-serif;font-variant-numeric:tabular-nums;letter-spacing:.2px;white-space:nowrap;border:1px solid rgba(0,0,0,.12);box-shadow:${ring}0 1px 4px rgba(0,0,0,.3);">${price.toFixed(1)}</span></div>`,
    iconSize: [62, 26],
    iconAnchor: [31, 13],
  });
}

function createExciseIcon(label: string, color: string): L.DivIcon {
  return L.divIcon({
    className: "price-marker",
    html: `<div style="display:flex;align-items:center;justify-content:center;width:62px;height:26px;"><span style="background:${color};color:#fff;padding:3px 8px;border-radius:9px;font:600 12px/1.1 -apple-system,system-ui,'Segoe UI',sans-serif;font-variant-numeric:tabular-nums;letter-spacing:.2px;white-space:nowrap;border:1px solid rgba(0,0,0,.12);box-shadow:0 1px 4px rgba(0,0,0,.3);">${label}</span></div>`,
    iconSize: [62, 26],
    iconAnchor: [31, 13],
  });
}

// Neutral cluster bubble: shows the CHEAPEST price grouped inside (falling back
// to a count until per-marker prices attach). Deliberately slate — NOT a rank
// colour — so a cluster is never misread as a cheap/expensive price signal.
function createClusterIcon(cluster: L.MarkerCluster): L.DivIcon {
  const count = cluster.getChildCount();
  let min = Infinity;
  let minColor = "#334155";
  for (const m of cluster.getAllChildMarkers()) {
    const o = m.options as { price?: number; color?: string };
    if (typeof o.price === "number" && Number.isFinite(o.price) && o.price < min) {
      min = o.price;
      minColor = o.color ?? minColor;
    }
  }
  const hasPrice = Number.isFinite(min);
  // Colour the bubble by the CHEAPEST station it contains, using the same rank
  // palette as the pins — so a green cluster flags "the cheap options are here".
  const bg = hasPrice ? minColor : "#334155";
  const size = count < 10 ? 42 : count < 50 ? 48 : 54;
  const main = hasPrice ? min.toFixed(1) : String(count);
  const sub = hasPrice
    ? `<span style="font-size:10px;font-weight:500;opacity:.8;line-height:1;">${count} stns</span>`
    : "";
  const cap = hasPrice
    ? `<span style="font-size:8px;font-weight:600;opacity:.7;letter-spacing:.4px;line-height:1;">FROM</span>`
    : "";
  return L.divIcon({
    className: "fs-cluster",
    html: `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;width:${size}px;height:${size}px;border-radius:50%;background:${bg};color:#fff;border:2px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.35);font:700 14px/1 -apple-system,system-ui,'Segoe UI',sans-serif;font-variant-numeric:tabular-nums;">${cap}<span>${main}</span>${sub}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function getBoundsString(

map: L.Map): string {
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
  fuel,
}: {
  onBoundsChange: (bounds: string) => void;
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

function InvalidateOnResize() {
  // Leaflet measures its container on mount; in a flex layout that can race the
  // layout and leave grey tiles. Re-measure on the next tick.
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 0);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

const SELECT_HALO = L.divIcon({
  className: "fs-halo-wrap",
  html: `<div class="fs-halo"></div>`,
  iconSize: [72, 72],
  iconAnchor: [36, 36],
});

/**
 * Highlights one station after it's picked from the sidebar: reveals it from any
 * cluster (zooming/spiderfying as needed), centres it, and rings it with a
 * pulsing halo until the next genuine map gesture. The halo lives in shadowPane
 * so the price pill stays on top and clickable.
 */
function SelectionLayer({
  selected,
  clusterRef,
  markersById,
  onClear,
}: {
  selected: { id: string; lat: number; lng: number } | null;
  clusterRef: RefObject<L.MarkerClusterGroup | null>;
  markersById: RefObject<Map<string, L.Marker>>;
  onClear: () => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (!selected) return;
    const group = clusterRef.current;
    const marker = markersById.current?.get(selected.id);
    if (group && marker) {
      group.zoomToShowLayer(marker, () => map.panTo([selected.lat, selected.lng]));
    } else {
      map.flyTo([selected.lat, selected.lng], Math.max(map.getZoom(), 15));
    }
  }, [selected, map, clusterRef, markersById]);

  // The programmatic reveal fires move/zoom but NOT these gesture events, so the
  // highlight survives the fly and clears only when the user touches the map.
  useMapEvents({
    mousedown: onClear,
    dragstart: onClear,
  });

  if (!selected) return null;
  return (
    <Marker
      position={[selected.lat, selected.lng]}
      icon={SELECT_HALO}
      pane="shadowPane"
      interactive={false}
      keyboard={false}
    />
  );
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

      <StationSparkline stationId={station.id} fuel={priceEntry.fuel} />
      <SaObligations station={station} />
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
  const fetchController = useRef<AbortController | null>(null);
  const { discounts: activeDiscounts } = useDiscounts();
  const [areaMode, setAreaMode] = useState(false);
  const [selected, setSelected] = useState<{ id: string; lat: number; lng: number } | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const markersById = useRef<Map<string, L.Marker>>(new Map());
  const darkBasemap = useIsDarkTheme();
  const [brandFilter, setBrandFilter] = useState<string>("");

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
      } catch (e) {
        if ((e as { name?: string }).name !== "AbortError") console.error("Failed to fetch stations:", e);
      }
      setLoading(false);
    },
    [fuel]
  );

  // Compute effective price (post-discount) per station, then rank by that
  // and remember which stations had a discount applied so we can ring them.
  const displayFuel = activeFuel;
  const pricedStations = stations
    .map((s) => {
      const p = s.prices.find((pr) => pr.fuel === displayFuel)?.price;
      if (p == null) return null;
      const eff = applyToStation(s, p, activeDiscounts);
      return {
        id: s.id,
        effectiveCpl: eff.effectiveCpl,
        hasDiscount: eff.applied.length > 0,
      };
    })
    .filter(
      (x): x is { id: string; effectiveCpl: number; hasDiscount: boolean } =>
        x != null,
    );
  const rankColors = assignRankColors(
    pricedStations.map((s) => s.effectiveCpl),
    cheapestHighlightCount,
  );
  const colorById = new Map<string, string>();
  const effectiveById = new Map<string, { effectiveCpl: number; hasDiscount: boolean }>();
  pricedStations.forEach((s, i) => {
    colorById.set(s.id, rankColors[i]);
    effectiveById.set(s.id, { effectiveCpl: s.effectiveCpl, hasDiscount: s.hasDiscount });
  });

  // Use saved map position, or fall back to a broad Australia view
  const saved = loadMapPosition();
  const initialCenter: [number, number] = saved ? [saved.lat, saved.lng] : [-25.5, 134.5];
  const initialZoom = saved ? saved.zoom : 5;

  const brandsInView = Array.from(new Set(stations.map((s) => s.brand))).sort();
  const visibleStations = brandFilter ? stations.filter((s) => s.brand === brandFilter) : stations;

  // In-view stations, cheapest first, for the desktop side panel.
  const listRows = visibleStations
    .map((s) => {
      const eff = effectiveById.get(s.id);
      const color = colorById.get(s.id);
      const pump = s.prices.find((p) => p.fuel === displayFuel)?.price;
      if (!eff || !color || pump == null) return null;
      return { station: s, effectiveCpl: eff.effectiveCpl, hasDiscount: eff.hasDiscount, color, pump };
    })
    .filter(
      (x): x is { station: Station; effectiveCpl: number; hasDiscount: boolean; color: string; pump: number } =>
        x != null,
    )
    .sort((a, b) => a.effectiveCpl - b.effectiveCpl)
    .slice(0, 100);

  return (
    <div className="relative h-full w-full flex">
    <MapContainer center={initialCenter} zoom={initialZoom} className="h-full flex-1 min-w-0">
      <TileLayer
        key={darkBasemap ? "dark" : "light"}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url={darkBasemap ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"}
      />
      <MapController
        onBoundsChange={fetchStations}
        fuel={fuel}
      />
      <FlyTo center={flyTo} />
      <InvalidateOnResize />
      <SelectionLayer
        selected={selected}
        clusterRef={clusterRef}
        markersById={markersById}
        onClear={() => setSelected(null)}
      />
      <AreaAverageLayer enabled={areaMode} stations={stations} fuel={displayFuel} />
      <MarkerClusterGroup
        ref={clusterRef}
        key={`${brandFilter}:${displayFuel}`}
        iconCreateFunction={createClusterIcon}
        showCoverageOnHover={false}
        maxClusterRadius={60}
        chunkedLoading
      >
      {visibleStations.map((station) => {
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
        // Bubble shows effective (post-discount) price; affected stations get a red ring.
        const color = colorById.get(station.id) ?? "#6b7280";
        const eff = effectiveById.get(station.id);
        const labelPrice = eff?.effectiveCpl ?? priceEntry.price;
        const icon = createPriceIcon(labelPrice, color, eff?.hasDiscount ?? false);

        return (
          <Marker
            key={station.id}
            position={[station.lat, station.lng]}
            icon={icon}
            ref={(m) => {
              if (m) {
                const o = m.options as { price?: number; color?: string };
                o.price = labelPrice;
                o.color = color;
                markersById.current.set(station.id, m);
              } else {
                markersById.current.delete(station.id);
              }
            }}
          >
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
      </MarkerClusterGroup>
      {/* Top-stacked notices: fuel fallback, loading */}
      <div
        className="absolute top-2 left-1/2 -translate-x-1/2 z-[1000] flex flex-col gap-2 items-center w-[calc(100%-1rem)] max-w-md"
        aria-live="polite"
      >
        <FreshnessChip />
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
      <div className="absolute bottom-4 left-3 z-[1000] pointer-events-auto">
        <button type="button" onClick={() => setAreaMode((m) => !m)} aria-pressed={areaMode} className={"inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium shadow-lg transition-colors " + (areaMode ? "bg-fs-accent text-fs-accent-ink" : "bg-fs-surface text-fs-ink hover:bg-fs-bg")}>
          <span aria-hidden="true">📍</span> {areaMode ? "Tap the map…" : "Area average"}
        </button>
      </div>
    </MapContainer>
    <aside className="hidden md:flex md:flex-col w-80 bg-fs-surface text-fs-ink border-l border-fs-line overflow-y-auto" style={{ fontFamily: "var(--fs-font-body)" }}>
      <div className="sticky top-0 bg-fs-surface border-b border-fs-line px-3 py-2">
        <div className="text-xs text-fs-muted">
          {listRows.length} stations in view{listRows[0] ? ` · cheapest ${listRows[0].effectiveCpl.toFixed(1)} c/L` : ""}
        </div>
        <select
          value={brandFilter}
          onChange={(e) => setBrandFilter(e.target.value)}
          className="mt-1.5 w-full text-xs border border-fs-line rounded px-2 py-1 bg-fs-surface text-fs-ink"
          aria-label="Filter by brand"
        >
          <option value="">All brands</option>
          {brandsInView.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>
      <ul>
        {listRows.map((r) => (
          <li key={r.station.id}>
            <button
              type="button"
              onClick={() => setSelected({ id: r.station.id, lat: r.station.lat, lng: r.station.lng })}
              className="w-full text-left px-3 py-2 border-b border-fs-line hover:bg-fs-bg flex items-center gap-2"
            >
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: r.color }} aria-hidden="true" />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium text-fs-ink truncate">{r.station.brand}</span>
                <span className="block text-xs text-fs-muted truncate">{r.station.suburb || r.station.address}</span>
              </span>
              <span className="text-right flex-shrink-0">
                <span className="block text-sm font-semibold text-fs-ink">{r.effectiveCpl.toFixed(1)}</span>
                {r.hasDiscount && (
                  <span className="block text-[10px] text-fs-muted line-through">{r.pump.toFixed(1)}</span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
    </div>
  );
}
