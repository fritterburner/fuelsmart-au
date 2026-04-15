import { NextResponse } from "next/server";
import { getLastUpdate, getStateLastUpdate } from "@/lib/cache";

export async function GET() {
  const [global, nt, qld, wa, nsw, tas] = await Promise.all([
    getLastUpdate(),
    getStateLastUpdate("NT"),
    getStateLastUpdate("QLD"),
    getStateLastUpdate("WA"),
    getStateLastUpdate("NSW"),
    getStateLastUpdate("TAS"),
  ]);

  return NextResponse.json({
    lastUpdate: global,
    states: { NT: nt, QLD: qld, WA: wa, NSW: nsw, TAS: tas },
  });
}
