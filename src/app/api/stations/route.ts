import { NextRequest, NextResponse } from "next/server";
import { getCachedStations } from "@/lib/cache";
import { FuelCode } from "@/lib/types";
import { FUEL_FALLBACKS } from "@/lib/fuel-codes";

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
  // If none found, try fallback fuels (e.g. LAF for U91 in remote areas)
  let activeFuel = fuel;
  let fallbackNotice: string | null = null;

  if (fuel) {
    const primary = filtered.filter((s) =>
      s.prices.some((p) => p.fuel === fuel)
    );

    if (primary.length > 0) {
      filtered = primary;
    } else {
      // Try fallback fuels
      const fallbacks = FUEL_FALLBACKS[fuel];
      if (fallbacks) {
        for (const fb of fallbacks) {
          const fbStations = filtered.filter((s) =>
            s.prices.some((p) => p.fuel === fb)
          );
          if (fbStations.length > 0) {
            filtered = fbStations;
            activeFuel = fb;
            const fuelNames: Record<string, string> = {
              LAF: "Low Aromatic / OPAL",
              U91: "Unleaded 91",
              E10: "Ethanol 94 (E10)",
            };
            fallbackNotice = `No ${fuelNames[fuel] || fuel} available in this area. Showing ${fuelNames[fb] || fb} instead.`;
            break;
          }
        }
        // If no fallback found either, return empty
        if (!fallbackNotice) {
          filtered = [];
        }
      } else {
        filtered = primary; // empty, no fallbacks defined
      }
    }
  }

  return NextResponse.json({
    stations: filtered,
    activeFuel,
    fallbackNotice,
  });
}
