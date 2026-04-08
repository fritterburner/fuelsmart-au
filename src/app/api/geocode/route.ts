import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");
  if (!q) {
    return NextResponse.json({ error: "q parameter required" }, { status: 400 });
  }

  const resp = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q + " Australia")}&format=json&limit=5&addressdetails=1`,
    { headers: { "User-Agent": "FuelSmartAU/1.0" } }
  );
  const data = await resp.json();
  return NextResponse.json(data);
}
