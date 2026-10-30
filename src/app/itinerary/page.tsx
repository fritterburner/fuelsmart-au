"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import LocationInput from "@/components/LocationInput";
import NumberField from "@/components/NumberField";
import FuelSelect from "@/components/FuelSelect";
import TripResults from "@/components/TripResults";
import { TripComparison, TripStrategy } from "@/lib/types";
import { loadDiscounts } from "@/lib/useDiscounts";
import { ITINERARY_PRESETS } from "@/lib/itinerary-presets";
import {
  DEFAULT_VEHICLE,
  ItineraryStop,
  ItineraryVehicle,
  RoutePlan,
  arrivalDate,
  buildRouteParams,
  buildSchedule,
  buildTripPlanParams,
  formatDay,
  loadItinerary,
  loadRouteCache,
  rangeKm,
  saveItinerary,
  saveRouteCache,
  waypointHash,
} from "@/lib/itinerary";

const ItineraryMap = dynamic(() => import("@/components/ItineraryMap"), { ssr: false });

const DEFAULT_PRESET = ITINERARY_PRESETS[0];
const DEFAULT_DEPARTURE = "2026-11-02";

function fmtMinutes(min: number): string {
  if (!min || min <= 0) return "";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h === 0 ? `${m}m` : m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export default function ItineraryPage() {
  const [presetId, setPresetId] = useState<string | null>(DEFAULT_PRESET.id);
  const [stops, setStops] = useState<ItineraryStop[]>(DEFAULT_PRESET.stops);
  const [vehicle, setVehicle] = useState<ItineraryVehicle>(DEFAULT_VEHICLE);
  const [departureDate, setDepartureDate] = useState(DEFAULT_DEPARTURE);
  const [hydrated, setHydrated] = useState(false);

  const [newStopText, setNewStopText] = useState("");
  const [insertAfter, setInsertAfter] = useState<number | null>(null);

  // Route (cheap, on every edit)
  const [route, setRoute] = useState<RoutePlan | null>(null);
  const [routing, setRouting] = useState(false);
  const [routeError, setRouteError] = useState("");
  const routeAbort = useRef<AbortController | null>(null);

  // Fuel plan (expensive, on demand)
  const [comparison, setComparison] = useState<TripComparison | null>(null);
  const [plannedHash, setPlannedHash] = useState<string | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<TripStrategy>("optimised");
  const [pricing, setPricing] = useState(false);
  const [priceError, setPriceError] = useState("");
  const [plannedAt, setPlannedAt] = useState<string | null>(null);

  // Restore the draft the user was editing — edited over days, often with no
  // signal, so nothing may depend on the network until "Calculate".
  useEffect(() => {
    const saved = loadItinerary();
    if (saved) {
      setPresetId(saved.presetId);
      setStops(saved.stops);
      setVehicle(saved.vehicle);
      if (saved.departureDate) setDepartureDate(saved.departureDate);
    }
    const cached = loadRouteCache();
    if (cached) setRoute(cached);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveItinerary({ presetId, stops, vehicle, departureDate });
  }, [hydrated, presetId, stops, vehicle, departureDate]);

  const hash = useMemo(() => waypointHash(stops), [stops]);
  const routeIsCurrent = route?.hash === hash;

  // Route on edit: debounced, one request in flight, cached by waypoint hash.
  useEffect(() => {
    if (!hydrated || stops.length < 2 || routeIsCurrent) return;
    const t = setTimeout(async () => {
      routeAbort.current?.abort();
      const ac = new AbortController();
      routeAbort.current = ac;
      setRouting(true);
      setRouteError("");
      try {
        const resp = await fetch(`/api/route?${buildRouteParams(stops)}`, { signal: ac.signal });
        const data = await resp.json();
        if (!resp.ok) {
          setRouteError(data.error || "Routing failed");
        } else {
          const plan: RoutePlan = {
            hash,
            distanceKm: data.distance,
            durationMin: data.duration,
            geometry: data.geometry,
            legs: data.legs,
            provider: data.provider,
            fetchedAt: new Date().toISOString(),
          };
          setRoute(plan);
          saveRouteCache(plan);
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setRouteError("No connection — showing the last route saved on this device.");
        }
      } finally {
        if (routeAbort.current === ac) setRouting(false);
      }
    }, 900);
    return () => clearTimeout(t);
  }, [hydrated, stops, hash, routeIsCurrent]);

  function applyPreset(id: string) {
    const p = ITINERARY_PRESETS.find((x) => x.id === id);
    if (!p) return;
    setPresetId(id);
    setStops(p.stops.map((s) => ({ ...s })));
  }
  function removeStop(idx: number) {
    if (idx === 0 || idx === stops.length - 1) return;
    setStops(stops.filter((_, i) => i !== idx));
    setPresetId(null);
  }
  function moveStop(idx: number, dir: -1 | 1) {
    const j = idx + dir;
    if (idx <= 0 || idx >= stops.length - 1 || j <= 0 || j >= stops.length - 1) return;
    const next = [...stops];
    [next[idx], next[j]] = [next[j], next[idx]];
    setStops(next);
    setPresetId(null);
  }
  function setNights(idx: number, nights: number) {
    const next = [...stops];
    next[idx] = { ...next[idx], nights };
    setStops(next);
  }
  function addStop(lat: number, lng: number, label: string) {
    const at = insertAfter === null ? stops.length - 1 : insertAfter + 1;
    const next = [...stops];
    next.splice(at, 0, { label, lat, lng, nights: 1 });
    setStops(next);
    setPresetId(null);
    setNewStopText("");
    setInsertAfter(null);
  }

  async function calculate() {
    if (stops.length < 2) return;
    setPricing(true);
    setPriceError("");
    setSelectedStrategy("optimised");
    const enabled = loadDiscounts().filter((d) => d.enabled);
    const params = buildTripPlanParams(stops, vehicle, enabled.length > 0 ? JSON.stringify(enabled) : undefined);
    try {
      const resp = await fetch(`/api/trip-plan?${params}`);
      const result = await resp.json();
      if (!resp.ok) {
        setPriceError(result.error || "Could not plan the fuel stops. Try again when you have signal.");
      } else {
        setComparison(result);
        setPlannedHash(hash);
        setPlannedAt(new Date().toLocaleString("en-AU", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }));
      }
    } catch {
      setPriceError("No connection — the stops are saved on this device; calculate again when you have signal.");
    }
    setPricing(false);
  }

  const planIsCurrent = !!comparison && plannedHash === hash;
  const selected = comparison?.strategies.find((s) => s.strategy === selectedStrategy) ?? comparison?.strategies[0];
  const fills = planIsCurrent && selected ? selected.stops : [];

  const legs = route && routeIsCurrent
    ? buildSchedule(stops, departureDate, route.legs, fills)
    : buildSchedule(stops, departureDate, [], []);
  const haveLegKm = !!route && routeIsCurrent;

  const tankRange = rangeKm(vehicle, false);
  const fullRange = rangeKm(vehicle, true);
  const totalNights = stops.slice(1, -1).reduce((a, s) => a + (s.nights || 0), 0);
  const totalKm = haveLegKm ? route!.distanceKm : null;
  const totalTowMin = legs.reduce((a, l) => a + l.towingMinutes, 0);
  const arrive = arrivalDate(stops, departureDate);

  const input = "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-30 bg-slate-800 text-white px-3 py-3 flex items-center gap-3 shadow-md">
        <Link
          href="/"
          className="flex items-center justify-center w-10 h-10 min-h-[44px] min-w-[44px] rounded-full hover:bg-slate-700 active:bg-slate-600 transition-colors text-emerald-400"
          aria-label="Back to map"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
          </svg>
        </Link>
        <h1 className="font-bold text-lg">Road trip fuel plan</h1>
      </div>

      <div className="px-3 py-4 space-y-4 md:max-w-5xl md:mx-auto md:px-4 md:py-6 md:space-y-6">
        <section>
          <h2 className="text-xl md:text-2xl font-semibold text-gray-900 leading-tight">
            Pick a route, adjust the stops, then calculate where to fill.
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            The route, distances and dates update as you edit and are kept on this device.
            Prices are only fetched when you press <strong>Calculate best stops</strong>.
          </p>
        </section>

        {/* Route presets + departure */}
        <section className="bg-white rounded-xl border shadow-sm p-3 md:p-4 space-y-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Route option</div>
            <div className="flex flex-wrap gap-2">
              {ITINERARY_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  className={`rounded-full px-3 py-1.5 text-sm border min-h-[36px] transition-colors ${
                    presetId === p.id ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
                  }`}
                >
                  {p.name}
                  {p.approxKm ? <span className="opacity-70"> · {p.approxKm.toLocaleString()} km</span> : null}
                </button>
              ))}
              {presetId === null && (
                <span className="self-center text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-1">Custom (edited)</span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
            <label className="text-xs text-gray-600">Leave on
              <input type="date" value={departureDate} onChange={(e) => e.target.value && setDepartureDate(e.target.value)} className={input} />
            </label>
            <div className="text-xs text-gray-600">Arrive<div className="mt-1 text-sm font-medium text-gray-900 py-2">{formatDay(arrive)}</div></div>
            <div className="text-xs text-gray-600">Distance<div className="mt-1 text-sm font-medium text-gray-900 py-2">{totalKm ? `${Math.round(totalKm).toLocaleString()} km` : routing ? "routing…" : "—"}</div></div>
            <div className="text-xs text-gray-600">Towing time<div className="mt-1 text-sm font-medium text-gray-900 py-2">{haveLegKm ? fmtMinutes(totalTowMin) : "—"}<span className="text-gray-500 font-normal"> · {stops.length} stops · {totalNights} nights</span></div></div>
          </div>
        </section>

        {/* Map */}
        <div className="h-64 md:h-[28rem] rounded-xl overflow-hidden border shadow-sm">
          <ItineraryMap stops={stops} geometry={routeIsCurrent ? route!.geometry : null} fills={fills} routing={routing} />
        </div>
        {routeError && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-800 text-sm">{routeError}</div>
        )}

        {/* Legs — stop rows with the leg to the next stop beneath each */}
        <section className="bg-white rounded-xl border shadow-sm p-3 md:p-4">
          <div className="flex items-baseline justify-between mb-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Stops and legs</div>
            <div className="text-xs text-gray-500">{haveLegKm ? `Distances by road (${route!.provider.toUpperCase()}) · times at ${80} km/h towing` : "Distances appear once routed"}</div>
          </div>
          <ol className="space-y-0">
            {stops.map((s, i) => {
              const fixed = i === 0 || i === stops.length - 1;
              const leg = legs[i];
              const beyondTank = leg && leg.km > tankRange;
              const beyondAll = leg && leg.km > fullRange;
              return (
                <li key={`${s.label}-${i}`}>
                  {/* Stop row */}
                  <div className="py-2 flex items-center gap-2">
                    <span className={`w-7 h-7 rounded-full text-white text-xs flex items-center justify-center shrink-0 ${fixed ? "bg-teal-700" : "bg-slate-800"}`}>{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 leading-tight">{s.label}</div>
                      <div className="text-xs text-gray-500">
                        {i === 0 ? `Leave ${formatDay(departureDate)}` : i === stops.length - 1 ? `Arrive ${formatDay(arrive)}` : leg ? `Arrive ${formatDay(legs[i - 1].date)}` : ""}
                      </div>
                    </div>
                    {!fixed && (
                      <label className="flex items-center gap-1 text-xs text-gray-600">
                        <NumberField value={s.nights} onChange={(v) => setNights(i, v)} min={0} max={30}
                          className="w-12 rounded border border-gray-300 px-1.5 py-1 text-sm text-center" aria-label={`Nights at ${s.label}`} />
                        <span>nights</span>
                      </label>
                    )}
                    {!fixed && (
                      <div className="flex items-center gap-0.5">
                        <button type="button" onClick={() => moveStop(i, -1)} aria-label="Move up" className="w-8 h-8 rounded hover:bg-gray-100 text-gray-500 disabled:opacity-30" disabled={i <= 1}>↑</button>
                        <button type="button" onClick={() => moveStop(i, 1)} aria-label="Move down" className="w-8 h-8 rounded hover:bg-gray-100 text-gray-500 disabled:opacity-30" disabled={i >= stops.length - 2}>↓</button>
                        <button type="button" onClick={() => removeStop(i)} aria-label={`Remove ${s.label}`} className="w-8 h-8 rounded hover:bg-red-50 text-red-500">✕</button>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setInsertAfter(insertAfter === i ? null : i)}
                      aria-label={`Add a stop after ${s.label}`}
                      title="Add a stop after this one"
                      className={`w-8 h-8 rounded text-sm ${insertAfter === i ? "bg-emerald-600 text-white" : "hover:bg-gray-100 text-emerald-700"} ${i === stops.length - 1 ? "invisible" : ""}`}
                    >＋</button>
                  </div>

                  {/* Leg to the next stop */}
                  {leg && (
                    <div className="ml-3 pl-5 border-l-2 border-dashed border-gray-300 py-1.5 mb-1">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs">
                        <span className="text-gray-700 font-medium">{formatDay(leg.date)}</span>
                        {haveLegKm ? (
                          <>
                            <span className="text-gray-900 font-semibold">{Math.round(leg.km)} km</span>
                            <span className="text-gray-500">{fmtMinutes(leg.towingMinutes)} towing</span>
                            {beyondAll ? (
                              <span className="text-red-700 font-semibold">beyond tank + cans</span>
                            ) : beyondTank ? (
                              <span className="text-amber-700 font-medium">cans needed</span>
                            ) : leg.km > 300 ? (
                              <span className="text-amber-700">fill before leaving</span>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-gray-400">{routing ? "routing…" : "not routed yet"}</span>
                        )}
                      </div>
                      {planIsCurrent && (
                        leg.fills.length === 0 ? (
                          <div className="text-xs text-gray-400 mt-0.5">no fill on this leg</div>
                        ) : (
                          <ul className="mt-1 space-y-0.5">
                            {leg.fills.map((f) => (
                              <li key={f.station.id + f.distanceFromStart} className="flex items-baseline gap-2 text-sm">
                                <span className="text-emerald-700 font-semibold whitespace-nowrap">⛽ +{f.litresAdded.toFixed(0)} L</span>
                                <span className="flex-1 min-w-0 truncate">{f.station.name}<span className="text-gray-500"> · {f.station.suburb || f.station.address}</span></span>
                                <span className="whitespace-nowrap text-gray-700">{f.pricePerLitre.toFixed(1)}{f.fallbackFuel ? ` ${f.fallbackFuel}` : ""} · ${f.cost.toFixed(0)}</span>
                              </li>
                            ))}
                          </ul>
                        )
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>

          <div className="mt-3">
            <div className="text-xs text-gray-600 mb-1">
              {insertAfter === null ? "Add a stop before the destination (or press ＋ on a row to insert after it):" : `Insert after ${stops[insertAfter].label}:`}
            </div>
            <LocationInput value={newStopText} onChange={setNewStopText} onSelect={addStop} placeholder="e.g. Winton, Longreach, a caravan park…" />
          </div>
        </section>

        {/* Vehicle */}
        <section className="bg-white rounded-xl border shadow-sm p-3 md:p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Vehicle (towing)</div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <label className="text-xs text-gray-600 col-span-2">Preferred fuel
              <div className="mt-1"><FuelSelect value={vehicle.fuel} onChange={(fuel) => setVehicle({ ...vehicle, fuel })} /></div>
            </label>
            <label className="text-xs text-gray-600">Tank (L)
              <NumberField value={vehicle.tank} onChange={(tank) => setVehicle({ ...vehicle, tank })} min={10} max={400} className={input} />
            </label>
            <label className="text-xs text-gray-600">L/100 km
              <NumberField value={vehicle.consumption} onChange={(consumption) => setVehicle({ ...vehicle, consumption })} min={3} max={40} decimals={1} className={input} />
            </label>
            <label className="text-xs text-gray-600">Jerry cans (L)
              <NumberField value={vehicle.jerry} onChange={(jerry) => setVehicle({ ...vehicle, jerry })} min={0} max={200} className={input} />
            </label>
            <label className="text-xs text-gray-600">Reserve (%)
              <NumberField value={vehicle.reservePct} onChange={(reservePct) => setVehicle({ ...vehicle, reservePct })} min={0} max={30} className={input} />
            </label>
            <label className="text-xs text-gray-600">Start fuel (%)
              <NumberField value={vehicle.startFuelPct} onChange={(startFuelPct) => setVehicle({ ...vehicle, startFuelPct })} min={5} max={100} className={input} />
            </label>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            Usable range after reserve: <strong>{Math.round(tankRange)} km</strong> on the tank, <strong>{Math.round(fullRange)} km</strong> with the cans in.
            U91 falls back to Low Aromatic (OPAL) where that is all a town sells.
          </div>
        </section>

        <button
          type="button"
          onClick={calculate}
          disabled={pricing || stops.length < 2}
          className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white font-semibold py-3 min-h-[48px] shadow"
        >
          {pricing ? "Pricing the route… (20–40 s for a long trip)" : comparison ? "Recalculate best stops" : "Calculate best stops"}
        </button>

        {priceError && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm">{priceError}</div>}

        {comparison && selected && (
          <>
            {!planIsCurrent && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-800 text-sm">
                The stop list has changed since this plan was calculated — press Recalculate when you are happy with it. The fills below are for the previous list.
              </div>
            )}
            <div className="text-xs text-gray-500">Fuel plan calculated {plannedAt} with the prices held at that moment. Fill stops are shown on the map and under each leg above.</div>
            <TripResults comparison={comparison} onStrategyChange={setSelectedStrategy} selectedStrategy={selectedStrategy} />
          </>
        )}
      </div>

      <div className="bg-slate-900 text-gray-400 text-xs px-3 py-1 mt-8">
        Data: NT Gov, QLD Gov, <a href="https://www.fuelwatch.wa.gov.au" className="underline">FuelWatch WA</a>, <a href="https://www.fuelcheck.nsw.gov.au" className="underline">FuelCheck NSW</a>, FuelCheck TAS · Routing © OSRM / OpenStreetMap
      </div>
    </div>
  );
}
