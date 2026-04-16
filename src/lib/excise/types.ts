import type { Station } from "@/lib/types";

export type FuelBucket = "ULP" | "DIESEL" | "NA";

export interface BaselineCity {
  name: string;
  state: Station["state"];
  lat: number;
  lng: number;
  ulpBaseline: number; // cpl, 31 Mar 2026
  dieselBaseline: number; // cpl, 31 Mar 2026
}

export interface MarketData {
  brent_usd: number;
  aud_usd: number;
  as_of: string; // source-reported date
  fetched_at: string; // ISO timestamp of our fetch
  source: string;
  stale: boolean;
}

export type Verdict = "full" | "partial" | "none" | "price-rose" | "na";
export type Confidence = "high" | "medium" | "low";

export interface VerdictResult {
  expectedPriceCpl: number;
  oilImpactCpl: number;
  fxImpactCpl: number;
  passthroughCpl: number;
  passthroughPct: number;
  verdict: Verdict;
}

export interface NearestBaselineResult {
  city: BaselineCity;
  distanceKm: number;
  confidence: Confidence;
}
