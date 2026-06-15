import { NextRequest, NextResponse } from "next/server";
import { getStationHistory } from "@/lib/history";
import { FuelCode } from "@/lib/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const fuel = (request.nextUrl.searchParams.get("fuel") ?? "U91") as FuelCode;
  const days = Math.min(60, Math.max(1, Number(request.nextUrl.searchParams.get("days") ?? 30)));

  const series = await getStationHistory(id, fuel, days);
  return NextResponse.json({ stationId: id, fuel, series });
}
