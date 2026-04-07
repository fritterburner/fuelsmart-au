import { NextRequest, NextResponse } from "next/server";
import { getCachedStations } from "@/lib/cache";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const stations = await getCachedStations();
  if (!stations) {
    return NextResponse.json({ error: "No data available" }, { status: 503 });
  }

  const station = stations.find((s) => s.id === id);
  if (!station) {
    return NextResponse.json({ error: "Station not found" }, { status: 404 });
  }

  return NextResponse.json({ station });
}
