import { NextResponse } from "next/server";
import { refreshAllData } from "@/lib/refresh";

export const maxDuration = 60; // allow up to 60s for fetching all sources

export async function GET(request: Request) {
  // Verify cron secret in production
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await refreshAllData();
  return NextResponse.json(result);
}
