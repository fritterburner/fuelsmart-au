import { NextResponse } from "next/server";
import { refreshAllData } from "@/lib/refresh";
import { evaluateAndNotify } from "@/lib/alerts/run";

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

  // Price-alert evaluation runs right after a refresh, against whatever we
  // just cached. Never let it fail the refresh response — push/alert bugs
  // are logged into the same errors[] the refresh already reports.
  let alerts: Awaited<ReturnType<typeof evaluateAndNotify>> | { error: string } = {
    error: "not run",
  };
  try {
    alerts = await evaluateAndNotify();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`Alerts: ${msg}`);
    alerts = { error: msg };
  }

  return NextResponse.json({ ...result, alerts });
}
