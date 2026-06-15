import { NextRequest, NextResponse } from "next/server";
import { getUsageReport } from "@/lib/usage";

/**
 * Produces the aggregate usage report the SA Fuel Pricing Information Scheme can
 * request (Data Publisher T&Cs cl. 3.7): New / Returning / Active users by month
 * and by country. Protected by a bearer secret so it's not public.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.USAGE_REPORT_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const months = await getUsageReport(12);
  return NextResponse.json({ generatedAt: new Date().toISOString(), months });
}
