import { NextRequest, NextResponse } from "next/server";
import { getCachedStations } from "@/lib/cache";
import { planTripComparison } from "@/lib/trip-planner";
import { FuelCode } from "@/lib/types";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const origin = params.get("origin");
  const dest = params.get("dest");
  const fuel = (params.get("fuel") || "U91") as FuelCode;
  const tank = Number(params.get("tank") || 45);
  const consumption = Number(params.get("consumption") || 10.5);
  const jerry = Number(params.get("jerry") || 0);

  if (!origin || !dest) {
    return NextResponse.json({ error: "origin and dest required" }, { status: 400 });
  }

  // Get route from OSRM
  const [oLat, oLng] = origin.split(",").map(Number);
  const [dLat, dLng] = dest.split(",").map(Number);

  const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${oLng},${oLat};${dLng},${dLat}?overview=full&geometries=geojson`;
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
  });

  return NextResponse.json(comparison);
}
