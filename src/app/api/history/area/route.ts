import { NextRequest, NextResponse } from "next/server";
import { getAreaHistory } from "@/lib/history";
import { FuelCode } from "@/lib/types";

/**
 * Averaged price history for an arbitrary set of stations — the "tap an area"
 * circle. POST (not GET) because a circle can hold many station ids. Body:
 * { ids: string[], fuel?: FuelCode, days?: number }.
 */
export async function POST(request: NextRequest) {
  let body: { ids?: unknown; fuel?: unknown; days?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const ids = Array.isArray(body.ids)
    ? body.ids.filter((x): x is string => typeof x === "string").slice(0, 500)
    : [];
  const fuel = (typeof body.fuel === "string" ? body.fuel : "U91") as FuelCode;
  const days = Math.min(60, Math.max(1, Number(body.days ?? 30)));

  if (ids.length === 0) {
    return NextResponse.json({ fuel, count: 0, series: [] });
  }

  const series = await getAreaHistory(ids, fuel, days);
  return NextResponse.json({ fuel, count: ids.length, series });
}
