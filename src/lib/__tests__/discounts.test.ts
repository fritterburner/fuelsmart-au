import { effectiveCpl, evaluate, breakevenDetourKm, Discount } from "../discounts";

const docket: Discount = {
  id: "docket",
  name: "Coles 4c/L",
  type: "fixed_cpl",
  value: 4,
  appliesTo: "both",
  enabled: true,
};

const amex: Discount = {
  id: "amex",
  name: "Amex 2%",
  type: "percent_cashback",
  value: 2,
  appliesTo: "both",
  enabled: true,
};

const rebate: Discount = {
  id: "rebate",
  name: "$5 back",
  type: "fixed_rebate",
  value: 5,
  appliesTo: "both",
  enabled: true,
};

describe("effectiveCpl", () => {
  test("fixed c/L docket reduces pump price directly", () => {
    const { cpl } = effectiveCpl(220, 50, [docket], "A");
    expect(cpl).toBeCloseTo(216, 5);
  });

  test("% cashback applies to remaining price after c/L off", () => {
    const { cpl } = effectiveCpl(220, 50, [docket, amex], "A");
    // 220 - 4 = 216, then 2% off = 216 * 0.98 = 211.68
    expect(cpl).toBeCloseTo(211.68, 2);
  });

  test("fixed $ rebate amortised over fill litres", () => {
    // $5 rebate over 50L = 500c / 50L = 10 c/L
    const { cpl } = effectiveCpl(220, 50, [rebate], "A");
    expect(cpl).toBeCloseTo(210, 5);
  });

  test("disabled discount has no effect", () => {
    const disabled = { ...docket, enabled: false };
    const { cpl } = effectiveCpl(220, 50, [disabled], "A");
    expect(cpl).toBe(220);
  });

  test("appliesTo: 'A' does not apply to B", () => {
    const aOnly = { ...docket, appliesTo: "A" as const };
    const { cpl } = effectiveCpl(220, 50, [aOnly], "B");
    expect(cpl).toBe(220);
  });

  test("price never goes negative", () => {
    const monster: Discount = {
      id: "x",
      name: "huge",
      type: "fixed_cpl",
      value: 500,
      appliesTo: "both",
      enabled: true,
    };
    const { cpl } = effectiveCpl(220, 50, [monster], "A");
    expect(cpl).toBe(0);
  });
});

describe("evaluate", () => {
  test("closer station with worse price can lose to further cheaper one", () => {
    const result = evaluate({
      quotes: [
        { label: "A", name: "Close", pricePerLitre: 220, detourKm: 0 },
        { label: "B", name: "Far", pricePerLitre: 210, detourKm: 5 },
      ],
      discounts: [],
      fillLitres: 50,
      consumption: 10,
    });
    // A: 50L × 220c = $110, no detour = $110
    // B: 50L × 210c = $105; detour 5km × 10L/100km × 210c/100 = 0.5L × $2.10 = $1.05 → $106.05
    expect(result[0].totalCost).toBeCloseTo(110, 2);
    expect(result[1].totalCost).toBeCloseTo(106.05, 2);
  });

  test("discount swings the recommendation", () => {
    const result = evaluate({
      quotes: [
        { label: "A", name: "Close", pricePerLitre: 220, detourKm: 0 },
        { label: "B", name: "Far", pricePerLitre: 215, detourKm: 10 },
      ],
      discounts: [{ ...docket, appliesTo: "A" }],
      fillLitres: 50,
      consumption: 10,
    });
    // A with 4c/L off: 50L × 216c = $108, no detour = $108
    // B: 50L × 215c = $107.50; detour 10km × 10L/100km × 215c/100 = 1L × $2.15 = $2.15 → $109.65
    expect(result[0].totalCost).toBeCloseTo(108, 2);
    expect(result[1].totalCost).toBeCloseTo(109.65, 2);
  });
});

describe("breakevenDetourKm", () => {
  test("4c/L saving on 50L fill at 220c/L with 10L/100km consumption", () => {
    // saving = 50 × 4 / 100 = $2.00
    // detour cost per km = 10/100 × 220/100 = 0.1 × $2.20 = $0.22/km (round trip implicit)
    // breakeven = 2.00 / 0.22 = ~9.09 km
    const km = breakevenDetourKm(4, 50, 10, 220);
    expect(km).toBeCloseTo(9.09, 2);
  });

  test("returns 0 for zero saving", () => {
    expect(breakevenDetourKm(0, 50, 10, 220)).toBe(0);
  });

  test("returns 0 for negative saving", () => {
    expect(breakevenDetourKm(-2, 50, 10, 220)).toBe(0);
  });
});
