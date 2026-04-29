"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { loadSettings } from "@/lib/settings";
import { FUEL_TYPES } from "@/lib/fuel-codes";
import type { FuelCode, Station } from "@/lib/types";
import { loadDiscounts } from "@/lib/useDiscounts";
import { formatAge } from "@/lib/time-format";
import StationNavLinks from "@/components/StationNavLinks";

const FillUpMap = dynamic(() => import("./FillUpMap"), { ssr: false });

// Result shape mirrors src/lib/fill-up/find-best-stop.ts. Kept inline (small
// surface, no need to export the interfaces for one consumer).
interface CandidateDto {
  station: Station;
  priceCpl: number;
  pumpPriceCpl: number;
  hasDiscount: boolean;
  detourKm: number;
  fillCostAud: number;
  detourFuelCostAud: number;
  totalCostAud: number;
  geometry: [number, number][];
}

interface FillUpDto {
  directKm: number;
  fuelUsed: FuelCode;
  fallbackNotice: string | null;
  winner: CandidateDto | null;
  shortlist: CandidateDto[];
  onRouteCheapest: CandidateDto | null;
  savingsVsOnRoute: number;
}

type Placing = "a" | "b" | "done";

export default function FillUpPage() {
  const [a, setA] = useState<{ lat: number; lng: number } | null>(null);
  const [b, setB] = useState<{ lat: number; lng: number } | null>(null);
  const [placing, setPlacing] = useState<Placing>("a");

  const [fuel, setFuel] = useState<FuelCode>("U91");
  const [fillLitres, setFillLitres] = useState(50);
  const [consumption, setConsumption] = useState(10.5);

  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FillUpDto | null>(null);

  // Hydrate from settings on mount.
  useEffect(() => {
    const s = loadSettings();
    setFuel(s.defaultFuel);
    setFillLitres(s.tankSize);
    setConsumption(s.consumption);
  }, []);

  function onPointClick(lat: number, lng: number) {
    // Pins move the state forward; result clears so old data doesn't linger.
    setResult(null);
    setError(null);
    if (placing === "a") {
      setA({ lat, lng });
      setPlacing("b");
    } else if (placing === "b") {
      setB({ lat, lng });
      setPlacing("done");
    } else {
      // Tap-after-done treated as "edit B".
      setB({ lat, lng });
    }
  }

  function resetPins() {
    setA(null);
    setB(null);
    setPlacing("a");
    setResult(null);
    setError(null);
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("Your browser doesn't support geolocation.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setResult(null);
        setError(null);
        setA({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setPlacing(b ? "done" : "b");
      },
      () => setError("Couldn't get your location — pick the start point on the map."),
      { timeout: 10000 },
    );
  }

  // Cycle reassurance messages while loading — routing can take 2–4s with the
  // concurrency cap (and longer if a 429 retry fires). Gives the user a sense
  // of "we're working on it" without faking precise progress.
  useEffect(() => {
    if (!loading) {
      setLoadingStage(0);
      return;
    }
    const t1 = setTimeout(() => setLoadingStage(1), 2000);
    const t2 = setTimeout(() => setLoadingStage(2), 5000);
    const t3 = setTimeout(() => setLoadingStage(3), 10000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [loading]);

  const loadingMessage = [
    "Finding the best stop…",
    "Checking nearby stations…",
    "Still working — public routing service is a bit slow…",
    "Almost there…",
  ][loadingStage];

  async function findBest() {
    if (!a || !b) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const resp = await fetch("/api/fill-up", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          a, b, fuel, fillLitres, consumption,
          discounts: loadDiscounts(),
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error ?? `Error ${resp.status}`);
      } else {
        setResult(data);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const banner = useMemo(() => {
    if (placing === "a") return "Choose your starting point on the map.";
    if (placing === "b") return "Now choose where you're heading.";
    return "Ready — tap the map to adjust point B, or find the best stop.";
  }, [placing]);

  const winnerPriceUpdated = useMemo(() => {
    if (!result?.winner) return null;
    const entry = result.winner.station.prices.find((p) => p.fuel === result.fuelUsed);
    return entry?.updated ?? null;
  }, [result]);

  const shortlistPins = useMemo(
    () =>
      (result?.shortlist ?? []).map((c) => ({
        lat: c.station.lat,
        lng: c.station.lng,
        price: c.priceCpl,
        name: c.station.name,
        suburb: c.station.suburb,
      })),
    [result],
  );
  const winnerPin = useMemo(
    () =>
      result?.winner
        ? {
            lat: result.winner.station.lat,
            lng: result.winner.station.lng,
            price: result.winner.priceCpl,
            name: result.winner.station.name,
            suburb: result.winner.station.suburb,
          }
        : null,
    [result],
  );

  return (
    <div className="h-dvh flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-slate-800 text-white shadow-md z-[1000] safe-area-top">
        <div className="flex items-center gap-3 px-3 py-2">
          <a
            href="/"
            className="flex items-center justify-center w-10 h-10 min-h-[44px] min-w-[44px] rounded-full hover:bg-slate-700 active:bg-slate-600 transition-colors text-emerald-400"
            aria-label="Back to map"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
            </svg>
          </a>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-base md:text-lg leading-tight">Find a stop</h1>
            {placing === "a" && !a && (
              <p className="text-xs md:text-sm text-slate-300 truncate">
                Heading A → B today? We&apos;ll find the cheapest fill-up worth the detour.
              </p>
            )}
            {(placing !== "a" || a) && (
              <p className="text-xs md:text-sm text-slate-300 truncate" aria-live="polite">{banner}</p>
            )}
          </div>
          <button
            onClick={resetPins}
            className="px-3 py-2 min-h-[40px] text-sm rounded-lg bg-slate-700 hover:bg-slate-600 active:bg-slate-600 transition-colors disabled:opacity-50"
            disabled={!a && !b}
          >
            Reset
          </button>
        </div>

        {/* Step pill: visual progress for picking A and B. Hidden once both placed. */}
        {placing !== "done" && (
          <div className="px-3 pb-1 flex items-center gap-2 text-xs">
            <StepDot active={placing === "a"} done={!!a} label="Start" />
            <span className="text-slate-500" aria-hidden="true">—</span>
            <StepDot active={placing === "b"} done={!!b} label="Destination" />
            {placing === "a" && !a && (
              <button
                type="button"
                onClick={useMyLocation}
                className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-700 hover:bg-slate-600 active:bg-slate-600 text-slate-100 transition-colors"
                title="Use my current location for the start point"
              >
                <span aria-hidden="true">📍</span> Use my location
              </button>
            )}
          </div>
        )}

        {/* Controls row */}
        <div className="flex flex-wrap items-center gap-2 px-3 pb-2 text-sm">
          <label className="flex items-center gap-1">
            <span className="text-slate-300">Fuel</span>
            <select
              value={fuel}
              onChange={(e) => setFuel(e.target.value as FuelCode)}
              className="bg-slate-700 text-white px-2 py-1 rounded border border-slate-600"
            >
              {FUEL_TYPES.map((f) => (
                <option key={f.code} value={f.code}>
                  {f.code}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1">
            <span className="text-slate-300">Expected fill</span>
            <input
              type="number"
              value={fillLitres}
              onChange={(e) =>
                setFillLitres(Math.max(5, Math.min(200, Number(e.target.value) || 5)))
              }
              min={5}
              max={200}
              className="bg-slate-700 text-white px-2 py-1 rounded w-16 border border-slate-600"
            />
            <span className="text-slate-300">L</span>
          </label>
          <label className="flex items-center gap-1">
            <span className="text-slate-300">L/100km</span>
            <input
              type="number"
              value={consumption}
              onChange={(e) =>
                setConsumption(Math.max(2, Math.min(40, Number(e.target.value) || 10)))
              }
              min={2}
              max={40}
              step={0.1}
              className="bg-slate-700 text-white px-2 py-1 rounded w-16 border border-slate-600"
            />
          </label>
          <button
            onClick={findBest}
            disabled={!a || !b || loading}
            className="ml-auto px-4 py-2 min-h-[40px] rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-sm font-bold transition-colors disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-not-allowed"
            aria-describedby={loading ? "fill-up-loading-hint" : undefined}
          >
            {loading ? "Finding…" : "Find the best stop"}
          </button>
        </div>
        {loading && (
          <div
            id="fill-up-loading-hint"
            role="status"
            aria-live="polite"
            className="px-3 pb-2 text-xs text-emerald-300 flex items-center gap-2"
          >
            <span
              aria-hidden="true"
              className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse"
            />
            {loadingMessage}
          </div>
        )}
      </header>

      {/* Map */}
      <div className="flex-1 relative">
        <FillUpMap
          onPointClick={onPointClick}
          a={a}
          b={b}
          winner={winnerPin}
          shortlist={shortlistPins}
          routeGeometry={result?.winner?.geometry ?? null}
        />
        {/* Floating CTA: appears once both points are placed, before a result. */}
        {placing === "done" && !result && !loading && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000]">
            <button
              onClick={findBest}
              className="px-5 py-3 min-h-[48px] rounded-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-sm font-bold shadow-lg transition-colors"
            >
              Find the best stop →
            </button>
          </div>
        )}
      </div>

      {/* Results panel */}
      {(result || error) && (
        <div className="bg-white border-t border-gray-200 max-h-[45vh] overflow-y-auto z-[900] safe-area-bottom">
          <div className="px-3 py-3 md:px-5 md:py-4 space-y-3">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
                ⚠ {error}
              </div>
            )}
            {result && (
              <>
                {result.fallbackNotice && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-lg px-3 py-2">
                    {result.fallbackNotice}
                  </div>
                )}

                {result.winner ? (
                  <WinnerCard result={result} priceUpdated={winnerPriceUpdated} />
                ) : (
                  <div className="text-sm text-gray-600">
                    No fuel stations found along this route. Try picking different points or a closer pair.
                  </div>
                )}

                {result.shortlist.length > 0 && (
                  <details className="text-sm">
                    <summary className="cursor-pointer font-medium text-slate-700 py-1">
                      Runners-up ({result.shortlist.length})
                    </summary>
                    <ul className="mt-2 space-y-1.5">
                      {result.shortlist.map((c) => (
                        <li
                          key={c.station.id}
                          className="px-3 py-2 bg-slate-50 rounded-lg"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-medium truncate">{c.station.name}</div>
                              <div className="text-xs text-gray-500 truncate">
                                {c.station.suburb} · {c.priceCpl.toFixed(1)} c/L · detour {c.detourKm.toFixed(1)} km
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="font-bold">${c.totalCostAud.toFixed(2)}</div>
                              <div className="text-xs text-gray-500">total</div>
                            </div>
                          </div>
                          <StationNavLinks lat={c.station.lat} lng={c.station.lng} name={c.station.name} />
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function WinnerCard({ result, priceUpdated }: { result: FillUpDto; priceUpdated: string | null }) {
  const w = result.winner!;
  const saves = result.savingsVsOnRoute;
  return (
    <div className="bg-emerald-50 border border-emerald-300 rounded-lg px-3 py-3 md:px-4 md:py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-emerald-700 font-semibold">
            Best stop
          </div>
          <div className="font-bold text-lg leading-tight truncate">{w.station.name}</div>
          <div className="text-sm text-gray-600 truncate">
            {w.station.suburb} {w.station.state}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-2xl font-bold text-emerald-700">{w.priceCpl.toFixed(1)}</div>
          <div className="text-xs text-emerald-700 -mt-1">c/L</div>
          {w.hasDiscount && (
            <div className="text-[10px] text-gray-500 line-through mt-0.5">
              {w.pumpPriceCpl.toFixed(1)}
            </div>
          )}
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3 text-sm">
        <dt className="text-gray-600">Fill cost</dt>
        <dd className="text-right font-medium">${w.fillCostAud.toFixed(2)}</dd>
        <dt className="text-gray-600">Detour</dt>
        <dd className="text-right font-medium">
          {w.detourKm.toFixed(1)} km (${w.detourFuelCostAud.toFixed(2)})
        </dd>
        <dt className="text-gray-600 font-semibold">Total</dt>
        <dd className="text-right font-bold">${w.totalCostAud.toFixed(2)}</dd>
      </dl>
      {saves > 0.5 && result.onRouteCheapest && (
        <p className="mt-2 text-xs text-emerald-700">
          Saves <strong>${saves.toFixed(2)}</strong> vs the cheapest station directly on your
          route ({result.onRouteCheapest.station.name}, {result.onRouteCheapest.priceCpl.toFixed(1)} c/L).
        </p>
      )}
      {saves <= 0.5 && result.onRouteCheapest && result.onRouteCheapest.station.id !== w.station.id && (
        <p className="mt-2 text-xs text-slate-600">
          Barely cheaper than the direct-on-route option — you could stop anywhere without much difference.
        </p>
      )}
      <p className="mt-2 text-[11px] text-gray-500">
        Direct trip {result.directKm.toFixed(1)} km · fuel: {result.fuelUsed}
        {priceUpdated && <> · price updated {formatAge(priceUpdated)}</>}
      </p>
      <StationNavLinks lat={w.station.lat} lng={w.station.lng} name={w.station.name} />
    </div>
  );
}

function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className={
          done
            ? "inline-block w-2.5 h-2.5 rounded-full bg-emerald-400"
            : active
              ? "inline-block w-2.5 h-2.5 rounded-full ring-2 ring-emerald-300 ring-offset-1 ring-offset-slate-800 bg-emerald-500"
              : "inline-block w-2.5 h-2.5 rounded-full bg-slate-500"
        }
      />
      <span className={done ? "text-emerald-300" : active ? "text-white font-medium" : "text-slate-400"}>
        {label}
      </span>
    </span>
  );
}
