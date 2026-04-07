import { NextRequest, NextResponse } from "next/server";
import { getCachedStations } from "@/lib/cache";
import { FuelCode } from "@/lib/types";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const bounds = params.get("bounds"); // swLat,swLng,neLat,neLng
  const fuel = params.get("fuel") as FuelCode | null;

  const stations = await getCachedStations();
  if (!stations) {
    return NextResponse.json(
      { error: "No data available. Try again later." },
      { status: 503 }
    );
  }

  let filtered = stations;

  // Filter by bounding box if provided
  if (bounds) {
    const [swLat, swLng, neLat, neLng] = bounds.split(",").map(Number);
    filtered = filtered.filter(
      (s) => s.lat >= swLat && s.lat <= neLat && s.lng >= swLng && s.lng <= neLng
    );
  }

  // Filter to only stations that have the selected fuel type
  if (fuel) {
    filtered = filtered.filter((s) =>
      s.prices.some((p) => p.fuel === fuel)
    );
  }

  return NextResponse.json({ stations: filtered });
}
