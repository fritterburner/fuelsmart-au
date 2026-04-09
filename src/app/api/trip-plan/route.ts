import { NextRequest, NextResponse } from "next/server";
import { getCachedStations } from "@/lib/cache";
import { planTripComparison, haversine } from "@/lib/trip-planner";
import { FuelCode, DestinationFuelInfo } from "@/lib/types";
import { FUEL_FALLBACKS } from "@/lib/fuel-codes";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const origin = params.get("origin");
  const dest = params.get("dest");
  const via = params.get("via");
  const fuel = (params.get("fuel") || "U91") as FuelCode;
  const tank = Number(params.get("tank") || 45);
  const consumption = Number(params.get("consumption") || 10.5);
  const jerry = Number(params.get("jerry") || 0);
  const startFuel = Number(params.get("startFuel") || 100);
  const allowFallback = params.get("fallback") !== "0"; // on by default
  const arriveFull = params.get("arriveFull") === "1"; // off by default
  const reservePct = Math.min(30, Math.max(0, Number(params.get("reservePct") || 10)));
  const returnTrip = params.get("returnTrip") === "1";

  if (!origin || !dest) {
    return NextResponse.json({ error: "origin and dest required" }, { status: 400 });
  }

  // Parse origin, destination, and via points
  const [oLat, oLng] = origin.split(",").map(Number);
  const [dLat, dLng] = dest.split(",").map(Number);

  // Build OSRM waypoints string: origin;via1;via2;...;dest (lng,lat format)
  const waypoints: string[] = [`${oLng},${oLat}`];

  if (via) {
    const viaPairs = via.split("|");
    for (const pair of viaPairs) {
      const [lat, lng] = pair.split(",").map(Number);
      waypoints.push(`${lng},${lat}`);
    }
  }

  waypoints.push(`${dLng},${dLat}`);

  // Return trip: A → V1 → V2 → B becomes A → V1 → V2 → B → V2 → V1 → A
  if (returnTrip) {
    // Reverse the via points and add origin as final destination
    const viaWaypoints = waypoints.slice(1, -1); // just the via points
    for (let i = viaWaypoints.length - 1; i >= 0; i--) {
      waypoints.push(viaWaypoints[i]);
    }
    waypoints.push(`${oLng},${oLat}`); // end back at origin
  }

  const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${waypoints.join(";")}?overview=full&geometries=geojson`;
  const routeResp = await fetch(osrmUrl);
  const routeData = await routeResp.json();

  if (routeData.code !== "Ok" || !routeData.routes?.[0]) {
    return NextResponse.json({ error: "No route found" }, { status: 404 });
  }

  const route = routeData.routes[0];
  const routeGeometry: [number, number][] = route.geometry.coordinates.map(
    ([lng, lat]: [number, number]) => [lat, lng]
  );
  const totalDistance = route.distance / 1000;

  // Get stations
  const stations = await getCachedStations();
  if (!stations) {
    return NextResponse.json({ error: "No station data available" }, { status: 503 });
  }

  const comparison = planTripComparison({
    fuel,
    tankSize: tank,
    consumption,
    jerryCapacity: jerry,
    routeGeometry,
    stations,
    totalDistance,
    startingFuelPct: startFuel,
    allowFallback,
    arriveFull,
    reservePct,
  });

  // Find cheapest fuel near final destination (within 25km)
  // For return trips, the final destination is the origin
  const totalCapacity = tank + jerry;
  const fallbacks = allowFallback ? (FUEL_FALLBACKS[fuel] || []) : [];
  let destinationFuel: DestinationFuelInfo | undefined;
  const finalLat = returnTrip ? oLat : dLat;
  const finalLng = returnTrip ? oLng : dLng;

  const nearDest = stations
    .map((s) => {
      const dist = haversine(finalLat, finalLng, s.lat, s.lng);
      if (dist > 25) return null;
      let priceEntry = s.prices.find((p) => p.fuel === fuel);
      let usedFuel = fuel;
      if (!priceEntry) {
        for (const fb of fallbacks) {
          priceEntry = s.prices.find((p) => p.fuel === fb);
          if (priceEntry) { usedFuel = fb; break; }
        }
      }
      if (!priceEntry) return null;
      return { station: s, price: priceEntry.price, fuel: usedFuel as FuelCode, distance: dist };
    })
    .filter(Boolean) as { station: typeof stations[0]; price: number; fuel: FuelCode; distance: number }[];

  if (nearDest.length > 0) {
    const cheapest = nearDest.reduce((best, s) => (s.price < best.price ? s : best));
    destinationFuel = {
      stationName: cheapest.station.name,
      brand: cheapest.station.brand,
      price: cheapest.price,
      fuel: cheapest.fuel,
      distance: cheapest.distance,
    };

    // Fill in destination fill costs for each strategy
    for (const strat of comparison.strategies) {
      strat.destinationFillLitres = Math.max(0, totalCapacity - strat.fuelAtDestination);
      strat.destinationFillCost = (strat.destinationFillLitres * cheapest.price) / 100;
      strat.trueTripCost = strat.totalFuelCost + strat.destinationFillCost;
    }
  }

  comparison.destinationFuel = destinationFuel;

  return NextResponse.json(comparison);
}
