import { Station, FuelCode, TripStop, TripPlan } from "./types";

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

export function planTrip(params: TripParams): TripPlan {
  const { fuel, tankSize, consumption, jerryCapacity, routeGeometry, stations, totalDistance } = params;
  const totalCapacity = tankSize + jerryCapacity;
  const kmPerLitre = 100 / consumption;

  // Safety: always keep at least 20% of tank OR 30km worth of fuel, whichever is larger
  const safetyLitres = Math.max(totalCapacity * 0.20, 30 / kmPerLitre);
  // Minimum fill: don't stop unless adding at least 15L (or 20% of tank for small tanks)
  const minFill = Math.max(15, totalCapacity * 0.20);
  // Minimum distance between stops: 50km (no Palmerston strip spam)
  const minStopGap = 50;

  // Find stations along route with their distance along route and price
  const routeStations = stations
    .map((s) => {
      const pos = distanceAlongRoute(s, routeGeometry, totalDistance);
      if (!pos) return null;
      const priceEntry = s.prices.find((p) => p.fuel === fuel);
      if (!priceEntry) return null;
      return { station: s, along: pos.along, price: priceEntry.price };
    })
    .filter(Boolean)
    .sort((a, b) => a!.along - b!.along) as {
    station: Station;
    along: number;
    price: number;
  }[];

  // Deduplicate: keep only the cheapest station per 10km segment
  const dedupedStations: typeof routeStations = [];
  for (const s of routeStations) {
    const existing = dedupedStations.find(
      (d) => Math.abs(d.along - s.along) < 3 // within 3km = same cluster
    );
    if (existing) {
      if (s.price < existing.price) {
        dedupedStations[dedupedStations.indexOf(existing)] = s;
      }
    } else {
      dedupedStations.push(s);
    }
  }

  const warnings: string[] = [];
  const stops: TripStop[] = [];
  let currentFuel = totalCapacity; // start with full tank
  let currentKm = 0;
  let lastStopKm = -minStopGap; // allow first stop anywhere

  // Greedy look-ahead algorithm with practical constraints
  while (currentKm < totalDistance) {
    const fuelNeededToFinish = (totalDistance - currentKm) / kmPerLitre;

    // Can we reach the destination with safety margin?
    if (currentFuel >= fuelNeededToFinish + safetyLitres) break;

    // How far can we drive with current fuel (minus safety)?
    const usableFuel = currentFuel - safetyLitres;
    const maxRangeKm = usableFuel * kmPerLitre;

    // Find reachable stations that are far enough from our last stop
    const reachable = dedupedStations.filter(
      (s) =>
        s.along > currentKm + 5 && // at least 5km ahead
        s.along <= currentKm + maxRangeKm && // within safe range
        s.along - lastStopKm >= minStopGap // respect minimum gap (unless emergency)
    );

    // If no stations respect the gap, relax the gap constraint (emergency)
    const candidates = reachable.length > 0
      ? reachable
      : dedupedStations.filter(
          (s) => s.along > currentKm + 5 && s.along <= currentKm + maxRangeKm
        );

    if (candidates.length === 0) {
      // Try with full fuel (ignore safety) as last resort
      const desperate = dedupedStations.filter(
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
      // Emergency: stop at the furthest-along cheap station
      const emergencyStop = desperate.reduce((best, s) => (s.price < best.price ? s : best));
      const fuelUsed = (emergencyStop.along - currentKm) / kmPerLitre;
      const fuelOnArrival = currentFuel - fuelUsed;
      const litresAdded = totalCapacity - fuelOnArrival;

      stops.push({
        station: emergencyStop.station,
        distanceFromStart: emergencyStop.along,
        fuelOnArrival,
        litresAdded,
        fuelOnDeparture: totalCapacity,
        cost: (litresAdded * emergencyStop.price) / 100,
        pricePerLitre: emergencyStop.price,
      });
      currentFuel = totalCapacity;
      currentKm = emergencyStop.along;
      lastStopKm = emergencyStop.along;
      continue;
    }

    // Find cheapest among candidates
    const cheapest = candidates.reduce((best, s) => (s.price < best.price ? s : best));

    const fuelUsedToStop = (cheapest.along - currentKm) / kmPerLitre;
    const fuelOnArrival = currentFuel - fuelUsedToStop;

    // Look ahead: is there a significantly cheaper station within one tank range?
    const futureStations = dedupedStations.filter(
      (s) => s.along > cheapest.along + minStopGap &&
             s.along <= cheapest.along + totalCapacity * kmPerLitre
    );
    const cheaperAhead = futureStations.find(
      (s) => s.price < cheapest.price * 0.95
    );

    // Decide how much to fill
    let litresAdded: number;
    if (cheaperAhead) {
      // Fill just enough to reach the cheaper station (with safety margin)
      const fuelNeededToReachCheap = (cheaperAhead.along - cheapest.along) / kmPerLitre + safetyLitres;
      litresAdded = Math.max(0, fuelNeededToReachCheap - fuelOnArrival);
    } else {
      // Fill to full — this is the best price around
      litresAdded = totalCapacity - fuelOnArrival;
    }

    litresAdded = Math.min(litresAdded, totalCapacity - fuelOnArrival);

    // Skip this stop if we'd add less than minimum fill AND we have enough fuel
    // to reach another station further ahead
    if (litresAdded < minFill) {
      const canReachFurther = dedupedStations.some(
        (s) => s.along > cheapest.along + minStopGap &&
               s.along <= currentKm + currentFuel * kmPerLitre
      );
      if (canReachFurther) {
        // Skip this stop — drive on with current fuel
        currentKm = cheapest.along + 1; // advance past this station
        continue;
      }
      // No choice — must stop here even for a small fill
      litresAdded = Math.max(litresAdded, Math.min(minFill, totalCapacity - fuelOnArrival));
    }

    litresAdded = Math.max(0, litresAdded);

    stops.push({
      station: cheapest.station,
      distanceFromStart: cheapest.along,
      fuelOnArrival,
      litresAdded,
      fuelOnDeparture: fuelOnArrival + litresAdded,
      cost: (litresAdded * cheapest.price) / 100,
      pricePerLitre: cheapest.price,
    });

    currentFuel = fuelOnArrival + litresAdded;
    currentKm = cheapest.along;
    lastStopKm = cheapest.along;
  }

  const totalFuelCost = stops.reduce((sum, s) => sum + s.cost, 0);

  // Naive cost: average price of all route stations × total fuel needed
  const allPrices = routeStations.map((s) => s.price);
  const avgPrice = allPrices.length > 0 ? allPrices.reduce((a, b) => a + b, 0) / allPrices.length : 0;
  const totalFuelNeeded = totalDistance / kmPerLitre;
  const naiveFuelCost = (totalFuelNeeded * avgPrice) / 100;

  return {
    origin: { lat: routeGeometry[0][0], lng: routeGeometry[0][1], label: "Origin" },
    destination: {
      lat: routeGeometry[routeGeometry.length - 1][0],
      lng: routeGeometry[routeGeometry.length - 1][1],
      label: "Destination",
    },
    totalDistance,
    totalFuelCost,
    naiveFuelCost,
    savings: naiveFuelCost - totalFuelCost,
    stops,
    routeGeometry,
    warnings,
  };
}
