import { Station, FuelCode, TripStop, TripPlan, TripComparison, StrategyResult } from "./types";

interface TripParams {
  fuel: FuelCode;
  tankSize: number; // litres
  consumption: number; // L/100km
  jerryCapacity: number; // litres (0 if none)
  routeGeometry: [number, number][]; // [lat, lng] pairs
  stations: Station[];
  totalDistance: number; // km
  startingFuelPct?: number; // 0-100, defaults to 100
}

// Haversine distance in km
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Project a point onto a line segment and return distance from the point to
// its closest position on the segment, plus how far along the segment that is (0-1).
function pointToSegmentDist(
  pLat: number, pLng: number,
  aLat: number, aLng: number,
  bLat: number, bLng: number
): { dist: number; t: number } {
  const dx = bLat - aLat;
  const dy = bLng - aLng;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { dist: haversine(pLat, pLng, aLat, aLng), t: 0 };
  const t = Math.max(0, Math.min(1, ((pLat - aLat) * dx + (pLng - aLng) * dy) / lenSq));
  const projLat = aLat + t * dx;
  const projLng = aLng + t * dy;
  return { dist: haversine(pLat, pLng, projLat, projLng), t };
}

// Compute cumulative distances along route geometry segments (cached per call batch).
let _cachedGeometry: [number, number][] | null = null;
let _cachedCumDist: number[] | null = null;

function getCumulativeDistances(routeGeometry: [number, number][]): number[] {
  if (_cachedGeometry === routeGeometry && _cachedCumDist) return _cachedCumDist;
  const cumDist = [0];
  for (let i = 1; i < routeGeometry.length; i++) {
    cumDist.push(
      cumDist[i - 1] +
        haversine(
          routeGeometry[i - 1][0], routeGeometry[i - 1][1],
          routeGeometry[i][0], routeGeometry[i][1]
        )
    );
  }
  _cachedGeometry = routeGeometry;
  _cachedCumDist = cumDist;
  return cumDist;
}

// Find all positions along the route where a station is nearby.
// Returns one entry per distinct "pass" — so a station near a route that doubles
// back will appear at multiple along-distances (once per pass).
function distanceAlongRoute(
  station: Station,
  routeGeometry: [number, number][],
  totalDistance: number
): { along: number; perpendicular: number }[] {
  const THRESHOLD = 15; // km
  const cumDist = getCumulativeDistances(routeGeometry);
  const totalHaversine = cumDist[cumDist.length - 1];
  if (totalHaversine === 0) return [];

  // Compute perpendicular distance for each segment
  const segResults: { dist: number; t: number }[] = [];
  for (let i = 0; i < routeGeometry.length - 1; i++) {
    segResults.push(
      pointToSegmentDist(
        station.lat, station.lng,
        routeGeometry[i][0], routeGeometry[i][1],
        routeGeometry[i + 1][0], routeGeometry[i + 1][1]
      )
    );
  }

  // Find contiguous runs of segments within threshold.
  // Each run = one pass of the route near this station. Keep the best match per run.
  const results: { along: number; perpendicular: number }[] = [];
  let inRun = false;
  let runBestDist = Infinity;
  let runBestIdx = 0;
  let runBestT = 0;

  for (let i = 0; i < segResults.length; i++) {
    if (segResults[i].dist <= THRESHOLD) {
      if (!inRun) {
        inRun = true;
        runBestDist = segResults[i].dist;
        runBestIdx = i;
        runBestT = segResults[i].t;
      } else if (segResults[i].dist < runBestDist) {
        runBestDist = segResults[i].dist;
        runBestIdx = i;
        runBestT = segResults[i].t;
      }
    } else if (inRun) {
      // End of run — emit best match
      const hDist = cumDist[runBestIdx] + runBestT * (cumDist[runBestIdx + 1] - cumDist[runBestIdx]);
      results.push({
        along: (hDist / totalHaversine) * totalDistance,
        perpendicular: runBestDist,
      });
      inRun = false;
      runBestDist = Infinity;
    }
  }
  // Flush final run
  if (inRun) {
    const hDist = cumDist[runBestIdx] + runBestT * (cumDist[runBestIdx + 1] - cumDist[runBestIdx]);
    results.push({
      along: (hDist / totalHaversine) * totalDistance,
      perpendicular: runBestDist,
    });
  }

  return results;
}

interface RouteStation {
  station: Station;
  along: number;
  price: number;
}

function prepareRouteStations(
  stations: Station[],
  fuel: FuelCode,
  routeGeometry: [number, number][],
  totalDistance: number
): { all: RouteStation[]; deduped: RouteStation[] } {
  // Reset cumulative distance cache for this route
  _cachedGeometry = null;
  _cachedCumDist = null;

  const routeStations: RouteStation[] = [];
  for (const s of stations) {
    const priceEntry = s.prices.find((p) => p.fuel === fuel);
    if (!priceEntry) continue;
    const positions = distanceAlongRoute(s, routeGeometry, totalDistance);
    for (const pos of positions) {
      routeStations.push({ station: s, along: pos.along, price: priceEntry.price });
    }
  }
  routeStations.sort((a, b) => a.along - b.along);

  // Deduplicate: keep only the cheapest station per 3km cluster
  const deduped: RouteStation[] = [];
  for (const s of routeStations) {
    const existing = deduped.find((d) => Math.abs(d.along - s.along) < 3);
    if (existing) {
      if (s.price < existing.price) {
        deduped[deduped.indexOf(existing)] = s;
      }
    } else {
      deduped.push(s);
    }
  }

  return { all: routeStations, deduped };
}

function makeStop(
  rs: RouteStation,
  currentKm: number,
  currentFuel: number,
  kmPerLitre: number,
  litresAdded: number
): TripStop {
  const fuelUsed = (rs.along - currentKm) / kmPerLitre;
  const fuelOnArrival = currentFuel - fuelUsed;
  return {
    station: rs.station,
    distanceFromStart: rs.along,
    fuelOnArrival,
    litresAdded,
    fuelOnDeparture: fuelOnArrival + litresAdded,
    cost: (litresAdded * rs.price) / 100,
    pricePerLitre: rs.price,
  };
}

// ─── Strategy 1: Optimised (smart fills, skip expensive) ────────────────────

function planOptimised(
  deduped: RouteStation[],
  totalCapacity: number,
  kmPerLitre: number,
  totalDistance: number,
  startingFuel: number
): { stops: TripStop[]; warnings: string[] } {
  const safetyLitres = Math.max(totalCapacity * 0.20, 30 / kmPerLitre);
  const minFill = Math.max(15, totalCapacity * 0.20);
  const minStopGap = 50;

  const warnings: string[] = [];
  const stops: TripStop[] = [];
  let currentFuel = startingFuel;
  let currentKm = 0;
  let lastStopKm = -minStopGap;

  while (currentKm < totalDistance) {
    const fuelNeededToFinish = (totalDistance - currentKm) / kmPerLitre;
    if (currentFuel >= fuelNeededToFinish + safetyLitres) break;

    const usableFuel = currentFuel - safetyLitres;
    const maxRangeKm = usableFuel * kmPerLitre;

    const reachable = deduped.filter(
      (s) =>
        s.along > currentKm + 5 &&
        s.along <= currentKm + maxRangeKm &&
        s.along - lastStopKm >= minStopGap
    );

    const candidates =
      reachable.length > 0
        ? reachable
        : deduped.filter((s) => s.along > currentKm + 5 && s.along <= currentKm + maxRangeKm);

    if (candidates.length === 0) {
      const desperate = deduped.filter(
        (s) => s.along > currentKm + 1 && s.along <= currentKm + currentFuel * kmPerLitre
      );
      if (desperate.length === 0) {
        warnings.push(
          `Warning: No reachable station from km ${Math.round(currentKm)}. ` +
            `Range: ${Math.round(currentFuel * kmPerLitre)} km. ` +
            `You may need more fuel capacity for this route.`
        );
        break;
      }
      const emergencyStop = desperate.reduce((best, s) => (s.price < best.price ? s : best));
      const fuelUsed = (emergencyStop.along - currentKm) / kmPerLitre;
      const fuelOnArrival = currentFuel - fuelUsed;
      const litresAdded = totalCapacity - fuelOnArrival;
      stops.push(makeStop(emergencyStop, currentKm, currentFuel, kmPerLitre, litresAdded));
      currentFuel = totalCapacity;
      currentKm = emergencyStop.along;
      lastStopKm = emergencyStop.along;
      continue;
    }

    const cheapest = candidates.reduce((best, s) => (s.price < best.price ? s : best));
    const fuelUsedToStop = (cheapest.along - currentKm) / kmPerLitre;
    const fuelOnArrival = currentFuel - fuelUsedToStop;

    const futureStations = deduped.filter(
      (s) =>
        s.along > cheapest.along + minStopGap &&
        s.along <= cheapest.along + totalCapacity * kmPerLitre
    );
    const cheaperAhead = futureStations.find((s) => s.price < cheapest.price * 0.95);

    let litresAdded: number;
    if (cheaperAhead) {
      const fuelNeededToReachCheap =
        (cheaperAhead.along - cheapest.along) / kmPerLitre + safetyLitres;
      litresAdded = Math.max(0, fuelNeededToReachCheap - fuelOnArrival);
    } else {
      litresAdded = totalCapacity - fuelOnArrival;
    }

    litresAdded = Math.min(litresAdded, totalCapacity - fuelOnArrival);

    if (litresAdded < minFill) {
      // Check if we can reach further stations with the fuel we'd have at this point
      const canReachFurther = deduped.some(
        (s) =>
          s.along > cheapest.along + minStopGap &&
          s.along <= cheapest.along + fuelOnArrival * kmPerLitre
      );
      if (canReachFurther) {
        // Skip this station — but track fuel burned driving here
        currentFuel = fuelOnArrival;
        currentKm = cheapest.along + 1;
        continue;
      }
      litresAdded = Math.max(litresAdded, Math.min(minFill, totalCapacity - fuelOnArrival));
    }

    litresAdded = Math.max(0, litresAdded);
    stops.push(makeStop(cheapest, currentKm, currentFuel, kmPerLitre, litresAdded));
    currentFuel = fuelOnArrival + litresAdded;
    currentKm = cheapest.along;
    lastStopKm = cheapest.along;
  }

  return { stops, warnings };
}

// ─── Strategy 2: Cheapest fill-up (always fill to brim at cheapest) ─────────

function planCheapestFill(
  deduped: RouteStation[],
  totalCapacity: number,
  kmPerLitre: number,
  totalDistance: number,
  startingFuel: number
): { stops: TripStop[]; warnings: string[] } {
  const safetyLitres = Math.max(totalCapacity * 0.20, 30 / kmPerLitre);
  const minStopGap = 50;

  const warnings: string[] = [];
  const stops: TripStop[] = [];
  let currentFuel = startingFuel;
  let currentKm = 0;
  let lastStopKm = -minStopGap;

  while (currentKm < totalDistance) {
    const fuelNeededToFinish = (totalDistance - currentKm) / kmPerLitre;
    if (currentFuel >= fuelNeededToFinish + safetyLitres) break;

    // When do we NEED to stop? When fuel drops to safety margin
    const usableFuel = currentFuel - safetyLitres;
    const maxRangeKm = usableFuel * kmPerLitre;

    // Find all reachable stations
    const reachable = deduped.filter(
      (s) =>
        s.along > currentKm + 5 &&
        s.along <= currentKm + maxRangeKm &&
        s.along - lastStopKm >= minStopGap
    );

    const candidates =
      reachable.length > 0
        ? reachable
        : deduped.filter((s) => s.along > currentKm + 5 && s.along <= currentKm + maxRangeKm);

    if (candidates.length === 0) {
      warnings.push(
        `Warning: No reachable station from km ${Math.round(currentKm)}.`
      );
      break;
    }

    // Pick the single cheapest reachable station, always fill to brim
    const cheapest = candidates.reduce((best, s) => (s.price < best.price ? s : best));
    const fuelUsedToStop = (cheapest.along - currentKm) / kmPerLitre;
    const fuelOnArrival = currentFuel - fuelUsedToStop;
    const litresAdded = totalCapacity - fuelOnArrival;

    stops.push(makeStop(cheapest, currentKm, currentFuel, kmPerLitre, litresAdded));
    currentFuel = totalCapacity;
    currentKm = cheapest.along;
    lastStopKm = cheapest.along;
  }

  return { stops, warnings };
}

// ─── Strategy 3: No planning (stop at first station when fuel light comes on) ─

function planNoPlanning(
  deduped: RouteStation[],
  totalCapacity: number,
  kmPerLitre: number,
  totalDistance: number,
  startingFuel: number
): { stops: TripStop[]; warnings: string[] } {
  // Fuel light comes on at ~1/8 tank (12.5%). Driver pulls into the next servo.
  const fuelLightThreshold = totalCapacity * 0.125;
  const safetyLitres = totalCapacity * 0.05; // absolute minimum before stranded

  const warnings: string[] = [];
  const stops: TripStop[] = [];
  let currentFuel = startingFuel;
  let currentKm = 0;

  while (currentKm < totalDistance) {
    const fuelNeededToFinish = (totalDistance - currentKm) / kmPerLitre;
    if (currentFuel >= fuelNeededToFinish + safetyLitres) break;

    // Drive until fuel light comes on
    const kmUntilLight = (currentFuel - fuelLightThreshold) * kmPerLitre;
    const fuelLightKm = currentKm + Math.max(0, kmUntilLight);

    // Find the first station AFTER the fuel light point (nearest servo once light is on)
    let nextStation = deduped.find(
      (s) => s.along >= fuelLightKm && s.along <= currentKm + currentFuel * kmPerLitre
    );

    // If nothing after the light point, look for the last station before running dry
    if (!nextStation) {
      const beforeDry = deduped.filter(
        (s) => s.along > currentKm + 1 && s.along <= currentKm + (currentFuel - safetyLitres) * kmPerLitre
      );
      nextStation = beforeDry.length > 0 ? beforeDry[beforeDry.length - 1] : undefined;
    }

    if (!nextStation) {
      warnings.push(
        `Warning: No reachable station from km ${Math.round(currentKm)}.`
      );
      break;
    }

    const fuelUsed = (nextStation.along - currentKm) / kmPerLitre;
    const fuelOnArrival = currentFuel - fuelUsed;
    const litresAdded = totalCapacity - fuelOnArrival;

    stops.push(makeStop(nextStation, currentKm, currentFuel, kmPerLitre, litresAdded));
    currentFuel = totalCapacity;
    currentKm = nextStation.along;
  }

  return { stops, warnings };
}

// ─── Build result from stops ────────────────────────────────────────────────

function buildStrategyResult(
  strategy: "optimised" | "cheapest_fill" | "no_planning",
  stops: TripStop[],
  warnings: string[]
): StrategyResult {
  const labels = {
    optimised: "Optimised",
    cheapest_fill: "Cheapest Fill-Up",
    no_planning: "No Planning",
  };
  const descriptions = {
    optimised: "Smart partial fills — skips expensive stations, buys less at pricey stops",
    cheapest_fill: "Always drives to the cheapest reachable station and fills to brim",
    no_planning: "Drives until the fuel light comes on, pulls into the next servo, fills to full",
  };

  const totalFuelCost = stops.reduce((sum, s) => sum + s.cost, 0);
  const totalLitres = stops.reduce((sum, s) => sum + s.litresAdded, 0);
  const avgPrice =
    totalLitres > 0
      ? stops.reduce((sum, s) => sum + s.pricePerLitre * s.litresAdded, 0) / totalLitres
      : 0;

  return {
    strategy,
    label: labels[strategy],
    description: descriptions[strategy],
    totalFuelCost,
    totalLitres,
    avgPricePerLitre: avgPrice,
    stops,
    warnings,
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

export function planTripComparison(params: TripParams): TripComparison {
  const { fuel, tankSize, consumption, jerryCapacity, routeGeometry, stations, totalDistance } =
    params;
  const startingFuelPct = params.startingFuelPct ?? 100;
  const totalCapacity = tankSize + jerryCapacity;
  const kmPerLitre = 100 / consumption;
  const startingFuel = totalCapacity * (startingFuelPct / 100);

  const { deduped } = prepareRouteStations(stations, fuel, routeGeometry, totalDistance);

  // Detect coverage gaps — warn if large sections of route have no stations
  const coverageWarnings: string[] = [];
  if (deduped.length > 0) {
    // Check gap from start to first station
    if (deduped[0].along > 200) {
      coverageWarnings.push(
        `No fuel price data for the first ${Math.round(deduped[0].along)} km of this route. ` +
        `The route may pass through states we don't have data for (SA, VIC, TAS).`
      );
    }
    // Check gap from last station to end
    if (totalDistance - deduped[deduped.length - 1].along > 200) {
      coverageWarnings.push(
        `No fuel price data for the last ${Math.round(totalDistance - deduped[deduped.length - 1].along)} km of this route.`
      );
    }
    // Check gaps between stations
    for (let i = 1; i < deduped.length; i++) {
      const gap = deduped[i].along - deduped[i - 1].along;
      if (gap > 500) {
        coverageWarnings.push(
          `${Math.round(gap)} km gap with no fuel data between km ${Math.round(deduped[i - 1].along)} and km ${Math.round(deduped[i].along)}. ` +
          `This section may pass through SA, VIC, or TAS where we don't yet have price data.`
        );
      }
    }
  } else if (totalDistance > 100) {
    coverageWarnings.push(
      `No fuel stations found along this ${Math.round(totalDistance)} km route. ` +
      `The route may pass entirely through states we don't have data for (SA, VIC, TAS, NSW).`
    );
  }

  const optimised = planOptimised(deduped, totalCapacity, kmPerLitre, totalDistance, startingFuel);
  const cheapestFill = planCheapestFill(deduped, totalCapacity, kmPerLitre, totalDistance, startingFuel);
  const noPlanning = planNoPlanning(deduped, totalCapacity, kmPerLitre, totalDistance, startingFuel);

  // Prepend coverage warnings to all strategies
  for (const result of [optimised, cheapestFill, noPlanning]) {
    result.warnings = [...coverageWarnings, ...result.warnings];
  }

  return {
    origin: { lat: routeGeometry[0][0], lng: routeGeometry[0][1], label: "Origin" },
    destination: {
      lat: routeGeometry[routeGeometry.length - 1][0],
      lng: routeGeometry[routeGeometry.length - 1][1],
      label: "Destination",
    },
    totalDistance,
    routeGeometry,
    strategies: [
      buildStrategyResult("optimised", optimised.stops, optimised.warnings),
      buildStrategyResult("cheapest_fill", cheapestFill.stops, cheapestFill.warnings),
      buildStrategyResult("no_planning", noPlanning.stops, noPlanning.warnings),
    ],
  };
}

// Keep legacy export for backward compat with tests
export function planTrip(params: TripParams): TripPlan {
  const comparison = planTripComparison(params);
  const opt = comparison.strategies[0];
  return {
    origin: comparison.origin,
    destination: comparison.destination,
    totalDistance: comparison.totalDistance,
    totalFuelCost: opt.totalFuelCost,
    naiveFuelCost: comparison.strategies[2].totalFuelCost,
    savings: comparison.strategies[2].totalFuelCost - opt.totalFuelCost,
    stops: opt.stops,
    routeGeometry: comparison.routeGeometry,
    warnings: opt.warnings,
  };
}
