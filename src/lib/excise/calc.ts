import {
  BASELINE_OIL_USD,
  BASELINE_AUD_USD,
  EXCISE_CUT_CPL,
  FX_RATIO,
  CRUDE_RATIO,
  VERDICT_THRESHOLDS,
} from "./baselines";
import type { BaselineCity, FuelBucket, Verdict, VerdictResult } from "./types";

export interface CalcVerdictArgs {
  pumpPriceCpl: number;
  fuel: FuelBucket;
  baseline: BaselineCity;
  liveOilUsd: number;
  liveAudUsd: number;
}

/**
 * Calculate the pass-through verdict for a given pump price.
 *
 * Formula (from 2026-04-16 design doc):
 *   oil_impact   = (live_oil - baseline_oil) / baseline_oil * 100 * crude_ratio
 *   fx_impact    = (baseline_aud - live_aud) / baseline_aud * 100 * FX_RATIO
 *   expected     = city_baseline - EXCISE_CUT + oil_impact + fx_impact
 *   passthrough  = EXCISE_CUT - (pump - expected)
 *   passthroughPct = passthrough / EXCISE_CUT * 100
 */
export function calcVerdict(args: CalcVerdictArgs): VerdictResult {
  const { pumpPriceCpl, fuel, baseline, liveOilUsd, liveAudUsd } = args;

  if (fuel === "NA") {
    return {
      expectedPriceCpl: 0,
      oilImpactCpl: 0,
      fxImpactCpl: 0,
      passthroughCpl: 0,
      passthroughPct: 0,
      verdict: "na",
    };
  }

  const cityBaseline = fuel === "ULP" ? baseline.ulpBaseline : baseline.dieselBaseline;
  const crudeRatio = fuel === "ULP" ? CRUDE_RATIO.ULP : CRUDE_RATIO.DIESEL;

  const oilChangePct = ((liveOilUsd - BASELINE_OIL_USD) / BASELINE_OIL_USD) * 100;
  const oilImpactCpl = oilChangePct * crudeRatio;

  const fxChangePct = ((BASELINE_AUD_USD - liveAudUsd) / BASELINE_AUD_USD) * 100;
  const fxImpactCpl = fxChangePct * FX_RATIO;

  const expectedPriceCpl = cityBaseline - EXCISE_CUT_CPL + oilImpactCpl + fxImpactCpl;
  const passthroughCpl = EXCISE_CUT_CPL - (pumpPriceCpl - expectedPriceCpl);
  const passthroughPct = (passthroughCpl / EXCISE_CUT_CPL) * 100;

  const verdict = classifyVerdict(pumpPriceCpl, cityBaseline, passthroughPct);

  return {
    expectedPriceCpl,
    oilImpactCpl,
    fxImpactCpl,
    passthroughCpl,
    passthroughPct,
    verdict,
  };
}

function classifyVerdict(
  pumpPriceCpl: number,
  cityBaseline: number,
  passthroughPct: number,
): Verdict {
  // "Price rose" check: pump is above the pre-cut baseline — excise is irrelevant
  // because the market moved enough to more than wipe out the cut.
  if (pumpPriceCpl > cityBaseline) return "price-rose";

  if (passthroughPct >= VERDICT_THRESHOLDS.fullMinPct) return "full";
  if (passthroughPct >= VERDICT_THRESHOLDS.partialMinPct) return "partial";
  return "none";
}
