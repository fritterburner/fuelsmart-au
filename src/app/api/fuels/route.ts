import { NextResponse } from "next/server";
import { FUEL_TYPES } from "@/lib/fuel-codes";

export async function GET() {
  return NextResponse.json({ fuels: FUEL_TYPES });
}
