import { NextRequest, NextResponse } from "next/server";
import { recordVisit } from "@/lib/usage";

/**
 * Records one pseudonymous visit for the SA usage report (licence cl. 3.7).
 * Body: { vid: string }. Region is derived from Vercel edge geo headers and
 * only stored as an aggregate count — the IP is never persisted.
 */
export async function POST(request: NextRequest) {
  let vid: string | undefined;
  try {
    const body = await request.json();
    vid = typeof body?.vid === "string" ? body.vid : undefined;
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  if (!vid || vid.length > 100) {
    return NextResponse.json({ error: "missing vid" }, { status: 400 });
  }

  const country = request.headers.get("x-vercel-ip-country") ?? "unknown";
  const city = request.headers.get("x-vercel-ip-city") ?? "";

  try {
    await recordVisit(vid, { country, city });
  } catch {
    // Never let analytics failure surface to the user.
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  return NextResponse.json({ ok: true });
}
