import { NextRequest, NextResponse } from "next/server";
import { getRoute, RouteThrottledError } from "@/lib/routing/get-route";

/**
 * Road route through an ordered set of points. No prices — this is the cheap
 * call an itinerary makes on every edit; pricing is /api/trip-plan.
 *
 * GET /api/route?origin=lat,lng&dest=lat,lng[&via=lat,lng|lat,lng]
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const origin = params.get("origin"); // lat,lng
  const dest = params.get("dest"); // lat,lng
  const via = params.get("via"); // lat,lng|lat,lng

  if (!origin || !dest) {
    return NextResponse.json({ error: "origin and dest required" }, { status: 400 });
  }

  const parse = (s: string): [number, number] | null => {
    const [lat, lng] = s.split(",").map(Number);
    return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
  };
  const waypoints: [number, number][] = [];
  const o = parse(origin);
  if (!o) return NextResponse.json({ error: "bad origin" }, { status: 400 });
  waypoints.push(o);
  if (via) {
    for (const pair of via.split("|")) {
      const v = parse(pair);
      if (!v) return NextResponse.json({ error: "bad via point" }, { status: 400 });
      waypoints.push(v);
    }
  }
  const d = parse(dest);
  if (!d) return NextResponse.json({ error: "bad dest" }, { status: 400 });
  waypoints.push(d);
  if (waypoints.length > 30) {
    return NextResponse.json({ error: "too many stops (max 30)" }, { status: 400 });
  }

  try {
    const route = await getRoute(waypoints);
    return NextResponse.json({
      distance: route.distanceMeters / 1000,
      duration: route.durationSeconds / 60,
      geometry: route.geometryLatLng,
      provider: route.provider,
      legs: route.legs.map((l) => ({
        km: l.distanceMeters / 1000,
        minutes: l.durationSeconds / 60,
      })),
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
