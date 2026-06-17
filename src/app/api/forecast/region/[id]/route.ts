import { NextRequest, NextResponse } from "next/server";
import { getRegionHistory } from "@/lib/history";
import { buildForecast } from "@/lib/forecast";
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

  const history = await getRegionHistory(id, fuel, 90);
  const points = history.map((p) => ({ date: p.date, value: p.avg }));
  const forecast = buildForecast(points, { fuel });

  return NextResponse.json({ region: id, fuel, history, forecast });
}
