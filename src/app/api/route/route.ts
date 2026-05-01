import { NextRequest, NextResponse } from "next/server";
import { getRoute, RouteThrottledError } from "@/lib/routing/get-route";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const origin = params.get("origin"); // lat,lng
  const dest = params.get("dest"); // lat,lng

  if (!origin || !dest) {
    return NextResponse.json({ error: "origin and dest required" }, { status: 400 });
  }

  const [oLat, oLng] = origin.split(",").map(Number);
  const [dLat, dLng] = dest.split(",").map(Number);

  try {
    const route = await getRoute([
      [oLat, oLng],
      [dLat, dLng],
    ]);
    return NextResponse.json({
      distance: route.distanceMeters / 1000,
      duration: route.durationSeconds / 60,
      geometry: route.geometryLatLng,
      provider: route.provider,
    });
  } catch (e) {
    if (e instanceof RouteThrottledError) {
      return NextResponse.json(
        { error: e.message, retryable: true },
        { status: 503 },
      );
    }
    if ((e as Error).message?.startsWith("OSRM no route")) {
      return NextResponse.json({ error: "No route found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: `Routing failed: ${(e as Error).message}` },
      { status: 503 },
    );
  }
}
