import { NextRequest, NextResponse } from "next/server";
import { getStateHistory } from "@/lib/history";
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
  const days = Math.min(60, Math.max(1, Number(request.nextUrl.searchParams.get("days") ?? 30)));

  const series = await getStateHistory(code, fuel, days);
  return NextResponse.json({ state: code, fuel, series });
}
