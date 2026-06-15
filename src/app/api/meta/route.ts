import { NextResponse } from "next/server";
import { getLastUpdate, getStateLastUpdate } from "@/lib/cache";

export async function GET() {
  const [global, nt, qld, wa, nsw, act, tas, sa, vic] = await Promise.all([
    getLastUpdate(),
    getStateLastUpdate("NT"),
    getStateLastUpdate("QLD"),
    getStateLastUpdate("WA"),
    getStateLastUpdate("NSW"),
    getStateLastUpdate("ACT"),
    getStateLastUpdate("TAS"),
    getStateLastUpdate("SA"),
    getStateLastUpdate("VIC"),
  ]);

  return NextResponse.json({
    lastUpdate: global,
    states: { NT: nt, QLD: qld, WA: wa, NSW: nsw, ACT: act, TAS: tas, SA: sa, VIC: vic },
  });
}
