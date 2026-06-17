import { NextRequest, NextResponse } from "next/server";
import { getRegionHistory } from "@/lib/history";
import { isValidRegion } from "@/lib/regions";
import { FuelCode } from "@/lib/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isValidRegion(id)) {
    return NextResponse.json({ error: "unknown region" }, { status: 400 });
  }

  const fuel = (request.nextUrl.searchParams.get("fuel") ?? "U91") as FuelCode;
  const days = Math.min(60, Math.max(1, Number(request.nextUrl.searchParams.get("days") ?? 30)));

  const series = await getRegionHistory(id, fuel, days);
  return NextResponse.json({ region: id, fuel, series });
}
