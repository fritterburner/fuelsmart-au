import { NextRequest, NextResponse } from "next/server";

const OSRM_BASE = "https://router.project-osrm.org";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const origin = params.get("origin"); // lat,lng
  const dest = params.get("dest"); // lat,lng

  if (!origin || !dest) {
    return NextResponse.json({ error: "origin and dest required" }, { status: 400 });
  }

  const [oLat, oLng] = origin.split(",").map(Number);
  const [dLat, dLng] = dest.split(",").map(Number);

  // OSRM uses lng,lat order
  const url = `${OSRM_BASE}/route/v1/driving/${oLng},${oLat};${dLng},${dLat}?overview=full&geometries=geojson`;

  const resp = await fetch(url);
  if (resp.status === 429) {
    return NextResponse.json(
      {
        error:
          "The public routing service is temporarily throttling us — try again in a minute or two.",
        retryable: true,
      },
      { status: 429 },
    );
  }
  if (!resp.ok) {
    return NextResponse.json(
      { error: `Routing service returned HTTP ${resp.status}` },
      { status: 503 },
    );
  }
  const data = await resp.json();

  if (data.code !== "Ok" || !data.routes?.[0]) {
    return NextResponse.json({ error: "No route found" }, { status: 404 });
  }

  const route = data.routes[0];
  return NextResponse.json({
    distance: route.distance / 1000, // metres to km
    duration: route.duration / 60, // seconds to minutes
    geometry: route.geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng]),
  });
}
