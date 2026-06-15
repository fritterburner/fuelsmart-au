import { NextRequest, NextResponse } from "next/server";
import { getStateHistory } from "@/lib/history";
import { buildForecast } from "@/lib/forecast";
import { FuelCode, StateCode } from "@/lib/types";

const VALID_STATES = new Set<StateCode>([
  "NT",
  "QLD",
  "WA",
  "NSW",
  "ACT",
  "SA",
  "VIC",
  "TAS",
]);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ state: string }> }
) {
  const { state } = await params;
  const code = state.toUpperCase() as StateCode;
  if (!VALID_STATES.has(code)) {
    return NextResponse.json({ error: "unknown state" }, { status: 400 });
  }

  const fuel = (request.nextUrl.searchParams.get("fuel") ?? "U91") as FuelCode;

  // Forecast off the state average; pull a wide lookback so the cycle model has
  // room (the backfill + extended TTL keep months of state history available).
  const history = await getStateHistory(code, fuel, 90);
  const points = history.map((p) => ({ date: p.date, value: p.avg }));
  const forecast = buildForecast(points, { fuel, state: code });

  return NextResponse.json({ state: code, fuel, history, forecast });
}
