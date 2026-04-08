import { Station, FuelCode, TripStop, TripPlan, TripComparison, StrategyResult } from "./types";

interface TripParams {
  fuel: FuelCode;
  tankSize: number; // litres
  consumption: number; // L/100km
  jerryCapacity: number; // litres (0 if none)
  routeGeometry: [number, number][]; // [lat, lng] pairs
  stations: Station[];
  totalDistance: number; // km
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

// Find the closest point on the route to a station, return distance along route in km
function distanceAlongRoute(
  station: Station,
  routeGeometry: [number, number][],
  totalDistance: number
): { along: number; perpendicular: number } | null {
  let minDist = Infinity;
  let bestIdx = 0;

  for (let i = 0; i < routeGeometry.length; i++) {
    const d = haversine(station.lat, station.lng, routeGeometry[i][0], routeGeometry[i][1]);
    if (d < minDist) {
      minDist = d;
      bestIdx = i;
    }
  }

  if (minDist > 5) return null; // more than 5km from route

  const along = (bestIdx / (routeGeometry.length - 1)) * totalDistance;
  return { along, perpendicular: minDist };
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
  const routeStations = stations
    .map((s) => {
      const pos = distanceAlongRoute(s, routeGeometry, totalDistance);
      if (!pos) return null;
      const priceEntry = s.prices.find((p) => p.fuel === fuel);
      if (!priceEntry) return null;
      return { station: s, along: pos.along, price: priceEntry.price };
    })
    .filter(Boolean)
    .sort((a, b) => a!.along - b!.along) as RouteStation[];

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
  totalDistance: number
): { stops: TripStop[]; warnings: string[] } {
  const safetyLitres = Math.max(totalCapacity * 0.20, 30 / kmPerLitre);
  const minFill = Math.max(15, totalCapacity * 0.20);
  const minStopGap = 50;

  const warnings: string[] = [];
  const stops: TripStop[] = [];
  let currentFuel = totalCapacity;
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
      const canReachFurther = deduped.some(
        (s) =>
          s.along > cheapest.along + minStopGap &&
          s.along <= currentKm + currentFuel * kmPerLitre
      );
      if (canReachFurther) {
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
  totalDistance: number
): { stops: TripStop[]; warnings: string[] } {
  const safetyLitres = Math.max(totalCapacity * 0.20, 30 / kmPerLitre);
  const minStopGap = 50;

  const warnings: string[] = [];
  const stops: TripStop[] = [];
  let currentFuel = totalCapacity;
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

// ─── Strategy 3: No planning (stop at first station when tank hits 25%) ─────

function planNoPlanning(
  deduped: RouteStation[],
  totalCapacity: number,
  kmPerLitre: number,
  totalDistance: number
): { stops: TripStop[]; warnings: string[] } {
  const lowFuelThreshold = totalCapacity * 0.25; // stop when 25% remaining
  const minStopGap = 20; // still avoid back-to-back but more relaxed

  const warnings: string[] = [];
  const stops: TripStop[] = [];
  let currentFuel = totalCapacity;
  let currentKm = 0;

  while (currentKm < totalDistance) {
    const fuelNeededToFinish = (totalDistance - currentKm) / kmPerLitre;
    if (currentFuel >= fuelNeededToFinish) break;

    // Drive until fuel drops to 25%
    const kmUntilLow = (currentFuel - lowFuelThreshold) * kmPerLitre;
    const lowFuelKm = currentKm + kmUntilLow;

    // Find the first station after we hit low fuel (or the last one before)
    const nextStation = deduped.find(
      (s) => s.along > currentKm + minStopGap && s.along <= lowFuelKm + 50 // some buffer
    );

    if (!nextStation) {
      // Try any station ahead within full range
      const anyStation = deduped.find(
        (s) => s.along > currentKm + 1 && s.along <= currentKm + currentFuel * kmPerLitre
      );
      if (!anyStation) {
        warnings.push(
          `Warning: No reachable station from km ${Math.round(currentKm)}.`
        );
        break;
      }
      const fuelUsed = (anyStation.along - currentKm) / kmPerLitre;
      const fuelOnArrival = currentFuel - fuelUsed;
      const litresAdded = totalCapacity - fuelOnArrival;
      stops.push(makeStop(anyStation, currentKm, currentFuel, kmPerLitre, litresAdded));
      currentFuel = totalCapacity;
      currentKm = anyStation.along;
      continue;
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
    no_planning: "Stops at the first available station when tank hits 25%, fills to full",
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
  const totalCapacity = tankSize + jerryCapacity;
  const kmPerLitre = 100 / consumption;

  const { deduped } = prepareRouteStations(stations, fuel, routeGeometry, totalDistance);

  const optimised = planOptimised(deduped, totalCapacity, kmPerLitre, totalDistance);
  const cheapestFill = planCheapestFill(deduped, totalCapacity, kmPerLitre, totalDistance);
  const noPlanning = planNoPlanning(deduped, totalCapacity, kmPerLitre, totalDistance);

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
