// Discount evaluation logic for the cashback vs. detour calculator.
// Pure functions — no side effects, safe to unit-test.

export type DiscountType = "fixed_cpl" | "percent_cashback" | "fixed_rebate";
export type AppliesTo = "both" | "A" | "B";

export interface Discount {
  id: string;
  name: string;
  type: DiscountType;
  /** For fixed_cpl: cents off per litre. For percent_cashback: % (e.g. 2 for 2%). For fixed_rebate: dollars back per fill. */
  value: number;
  appliesTo: AppliesTo;
  enabled: boolean;
}

export interface StationQuote {
  label: "A" | "B";
  name: string;
  pricePerLitre: number; // c/L at pump
  detourKm: number; // extra km round-trip vs doing nothing (station A = 0 by convention)
}

export interface EvaluatedQuote {
  label: "A" | "B";
  name: string;
  pumpPricePerLitre: number;
  effectivePricePerLitre: number; // after discounts, before detour
  fillCost: number; // dollars for `fillLitres` at effective price
  detourFuelCost: number; // dollars of fuel burned driving the detour
  totalCost: number; // fillCost + detourFuelCost
  appliedDiscounts: Array<{ id: string; name: string; valueCpl: number }>;
}

export interface EvaluateParams {
  quotes: [StationQuote, StationQuote];
  discounts: Discount[];
  fillLitres: number;
  consumption: number; // L/100km
}

/**
 * Apply active discounts to a station's pump price and return effective c/L.
 * Order of operations:
 *  1. Fixed c/L off reduces pump price directly.
 *  2. % cashback reduces the remaining price proportionally.
 *  3. Fixed $ rebate is amortised over the fill size (converted to c/L).
 */
export function effectiveCpl(
  pumpCpl: number,
  fillLitres: number,
  discounts: Discount[],
  side: "A" | "B"
): { cpl: number; applied: Array<{ id: string; name: string; valueCpl: number }> } {
  let cpl = pumpCpl;
  const applied: Array<{ id: string; name: string; valueCpl: number }> = [];

  const active = discounts.filter(
    (d) => d.enabled && (d.appliesTo === "both" || d.appliesTo === side)
  );

  // Step 1: fixed c/L
  for (const d of active.filter((x) => x.type === "fixed_cpl")) {
    const off = d.value;
    applied.push({ id: d.id, name: d.name, valueCpl: off });
    cpl -= off;
  }

  // Step 2: % cashback
  for (const d of active.filter((x) => x.type === "percent_cashback")) {
    const off = cpl * (d.value / 100);
    applied.push({ id: d.id, name: d.name, valueCpl: off });
    cpl -= off;
  }

  // Step 3: fixed $ rebate → amortise over the fill
  if (fillLitres > 0) {
    for (const d of active.filter((x) => x.type === "fixed_rebate")) {
      // rebate in dollars → cents; divide by litres = c/L
      const off = (d.value * 100) / fillLitres;
      applied.push({ id: d.id, name: d.name, valueCpl: off });
      cpl -= off;
    }
  }

  return { cpl: Math.max(0, cpl), applied };
}

export function evaluate({
  quotes,
  discounts,
  fillLitres,
  consumption,
}: EvaluateParams): EvaluatedQuote[] {
  return quotes.map((q) => {
    const { cpl, applied } = effectiveCpl(q.pricePerLitre, fillLitres, discounts, q.label);
    const fillCost = (fillLitres * cpl) / 100;
    // Detour fuel burned = extra km × consumption / 100 litres, valued at pump price (what you'd pay to replace it)
    const detourLitres = (q.detourKm * consumption) / 100;
    const detourFuelCost = (detourLitres * q.pricePerLitre) / 100;
    return {
      label: q.label,
      name: q.name,
      pumpPricePerLitre: q.pricePerLitre,
      effectivePricePerLitre: cpl,
      fillCost,
      detourFuelCost,
      totalCost: fillCost + detourFuelCost,
      appliedDiscounts: applied,
    };
  });
}

/**
 * Detour breakeven: how many extra km is worth driving to save X c/L?
 * saving_per_fill = fillLitres * savingCpl / 100   (dollars)
 * detour_cost_per_km = consumption/100 * pricePerLitre/100  (dollars per km)
 * breakeven_km = saving_per_fill / detour_cost_per_km
 */
export function breakevenDetourKm(
  savingCpl: number,
  fillLitres: number,
  consumption: number,
  pricePerLitre: number
): number {
  if (savingCpl <= 0 || consumption <= 0 || pricePerLitre <= 0) return 0;
  const savingDollars = (fillLitres * savingCpl) / 100;
  const detourCostPerKm = (consumption / 100) * (pricePerLitre / 100);
  return savingDollars / detourCostPerKm;
}
