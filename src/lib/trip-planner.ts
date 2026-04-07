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
  const safetyMargin = totalCapacity * 0.15;
  const kmPerLitre = 100 / consumption;

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

  const warnings: string[] = [];
  const stops: TripStop[] = [];
  let currentFuel = totalCapacity; // start with full tank
  let currentKm = 0;

  // Greedy look-ahead algorithm
  while (currentKm < totalDistance) {
    const fuelNeededToFinish = (totalDistance - currentKm) / kmPerLitre;

    // Can we reach the destination?
    if (currentFuel >= fuelNeededToFinish + safetyMargin) break;

    // Find reachable stations from current position
    const maxRange = currentFuel * kmPerLitre;
    const reachable = routeStations.filter(
      (s) => s.along > currentKm + 1 && s.along <= currentKm + maxRange
    );

    if (reachable.length === 0) {
      warnings.push(
        `Warning: No reachable station at km ${Math.round(currentKm)}. ` +
          `You may need more fuel capacity for this route.`
      );
      break;
    }

    // Look ahead: find cheapest station within range
    // But also check if we MUST stop soon (fuel getting low)
    const mustStopThreshold = currentKm + (currentFuel - safetyMargin) * kmPerLitre;

    // Find cheapest among reachable
    const cheapest = reachable.reduce((best, s) => (s.price < best.price ? s : best));

    // If we're running low, stop at the cheapest available
    // Otherwise, check if there's something cheaper further ahead
    let chosenStop = cheapest;

    // How much fuel to add?
    const fuelUsedToStop = (chosenStop.along - currentKm) / kmPerLitre;
    const fuelOnArrival = currentFuel - fuelUsedToStop;

    // Look ahead from this stop — what's the cheapest within one tank range?
    const futureStations = routeStations.filter(
      (s) => s.along > chosenStop.along && s.along <= chosenStop.along + totalCapacity * kmPerLitre
    );
    const cheaperAhead = futureStations.some((s) => s.price < chosenStop.price * 0.95);

    // If cheaper ahead, only fill enough to reach it; otherwise fill to brim
    let litresAdded: number;
    if (cheaperAhead && futureStations.length > 0) {
      const nextCheap = futureStations.reduce((best, s) => (s.price < best.price ? s : best));
      const fuelNeededToReachCheap = (nextCheap.along - chosenStop.along) / kmPerLitre + safetyMargin;
      litresAdded = Math.max(0, fuelNeededToReachCheap - fuelOnArrival);
    } else {
      litresAdded = totalCapacity - fuelOnArrival;
    }

    litresAdded = Math.min(litresAdded, totalCapacity - fuelOnArrival);
    litresAdded = Math.max(0, litresAdded);

    stops.push({
      station: chosenStop.station,
      distanceFromStart: chosenStop.along,
      fuelOnArrival,
      litresAdded,
      fuelOnDeparture: fuelOnArrival + litresAdded,
      cost: (litresAdded * chosenStop.price) / 100,
      pricePerLitre: chosenStop.price,
    });

    currentFuel = fuelOnArrival + litresAdded;
    currentKm = chosenStop.along;
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
