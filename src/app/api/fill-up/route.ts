import { NextRequest, NextResponse } from "next/server";
import { getCachedStations } from "@/lib/cache";
import { findBestStop } from "@/lib/fill-up/find-best-stop";
import { osrmRoute, OsrmThrottledError } from "@/lib/fill-up/osrm";
import { haversine } from "@/lib/trip-planner";
import type { FuelCode } from "@/lib/types";

/**
 * Click-A-click-B cheapest-fuel recommendation.
 *
 * POST body: { a: {lat,lng}, b: {lat,lng}, fuel, fillLitres, consumption }
 * Returns the `FindBestStopResult` shape — see find-best-stop.ts.
 *
 * 400 for invalid input, 503 for routing/cache failures, 200 otherwise
 * (winner may be null if no stations were found in the corridor).
 */

// Allow up to 30s for the 16 parallel OSRM calls (usually ~1s total).
export const maxDuration = 30;

const VALID_FUELS: FuelCode[] = ["U91", "DL", "E10", "P95", "P98", "PD", "LPG", "E85", "LAF"];

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = validate(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { a, b, fuel, fillLitres, consumption } = parsed;

  // Reject same-point / too-close requests — this isn't a trip.
  if (haversine(a.lat, a.lng, b.lat, b.lng) < 1) {
    return NextResponse.json(
      { error: "Pick two different points at least 1 km apart." },
      { status: 400 },
    );
  }

  let stations;
  try {
    stations = await getCachedStations();
  } catch (e) {
    return NextResponse.json(
      { error: `Station cache unavailable: ${(e as Error).message}` },
      { status: 503 },
    );
  }
  if (!stations) {
    return NextResponse.json(
      { error: "Station data not available — cache is empty." },
      { status: 503 },
    );
  }

  try {
    const result = await findBestStop(
      { a, b, stations, fuel, fillLitres, consumption },
      { osrmRoute },
    );
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof OsrmThrottledError) {
      return NextResponse.json({ error: e.message, retryable: true }, { status: 429 });
    }
    return NextResponse.json(
      { error: `Routing failed: ${(e as Error).message}` },
      { status: 503 },
    );
  }
}

// --- Validation -----------------------------------------------------------

interface ParsedBody {
  a: { lat: number; lng: number };
  b: { lat: number; lng: number };
  fuel: FuelCode;
  fillLitres: number;
  consumption: number;
}

function validate(body: unknown): ParsedBody | { error: string } {
  if (!body || typeof body !== "object") return { error: "Body must be an object" };
  const o = body as Record<string, unknown>;

  const a = parseLatLng(o.a);
  if (!a) return { error: "Invalid or missing `a` (expected {lat,lng})" };
  const b = parseLatLng(o.b);
  if (!b) return { error: "Invalid or missing `b` (expected {lat,lng})" };

  if (typeof o.fuel !== "string" || !(VALID_FUELS as string[]).includes(o.fuel)) {
    return { error: `Invalid fuel — must be one of ${VALID_FUELS.join(", ")}` };
  }

  const fillLitres = Number(o.fillLitres);
  if (!Number.isFinite(fillLitres) || fillLitres < 5 || fillLitres > 200) {
    return { error: "fillLitres must be between 5 and 200" };
  }

  const consumption = Number(o.consumption);
  if (!Number.isFinite(consumption) || consumption < 2 || consumption > 40) {
    return { error: "consumption (L/100km) must be between 2 and 40" };
  }

  return { a, b, fuel: o.fuel as FuelCode, fillLitres, consumption };
}

function parseLatLng(v: unknown): { lat: number; lng: number } | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const lat = Number(o.lat);
  const lng = Number(o.lng);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return null;
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) return null;
  return { lat, lng };
}
