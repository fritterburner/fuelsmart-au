import {
  effectiveCpl,
  evaluate,
  breakevenDetourKm,
  applyToStation,
  Discount,
} from "../discounts";

const docket: Discount = {
  id: "docket",
  name: "Coles 4c/L",
  type: "fixed_cpl",
  value: 4,
  appliesTo: "both",
  enabled: true,
  brands: [],
  states: [],
};

const amex: Discount = {
  id: "amex",
  name: "Amex 2%",
  type: "percent_cashback",
  value: 2,
  appliesTo: "both",
  enabled: true,
  brands: [],
  states: [],
};

const rebate: Discount = {
  id: "rebate",
  name: "$5 back",
  type: "fixed_rebate",
  value: 5,
  appliesTo: "both",
  enabled: true,
  brands: [],
  states: [],
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
      brands: [],
      states: [],
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

describe("applyToStation", () => {
  // Minimal station fixture — only the fields applyToStation reads.
  function stationFixture(overrides: { brand?: string; state?: string } = {}) {
    return {
      id: "s1",
      name: "Test Servo",
      brand: overrides.brand ?? "Shell",
      brandCode: "SHL",
      address: "1 Test St",
      suburb: "Testville",
      state: (overrides.state ?? "NSW") as "NSW" | "QLD" | "NT" | "WA" | "TAS" | "ACT",
      postcode: "0000",
      lat: 0,
      lng: 0,
      prices: [],
    };
  }

  // New-shape Discount builder — brands/states default to "any".
  function mk(over: Partial<Discount>): Discount {
    return {
      id: "x",
      name: "x",
      type: "fixed_cpl",
      value: 4,
      appliesTo: "both",
      enabled: true,
      brands: [],
      states: [],
      ...over,
    };
  }

  test("returns rack price when no discounts supplied", () => {
    const res = applyToStation(stationFixture(), 220, []);
    expect(res.effectiveCpl).toBe(220);
    expect(res.applied).toEqual([]);
  });

  test("returns rack price when all discounts are disabled", () => {
    const res = applyToStation(stationFixture(), 220, [mk({ enabled: false })]);
    expect(res.effectiveCpl).toBe(220);
    expect(res.applied).toEqual([]);
  });

  test("applies a 4 c/L fixed discount directly (no filters)", () => {
    const res = applyToStation(stationFixture(), 220, [mk({ value: 4 })]);
    expect(res.effectiveCpl).toBeCloseTo(216, 5);
    expect(res.applied).toHaveLength(1);
  });

  test("applies a % cashback as effective = rack × (1 − pct/100)", () => {
    const res = applyToStation(stationFixture(), 200, [
      mk({ type: "percent_cashback", value: 2 }),
    ]);
    expect(res.effectiveCpl).toBeCloseTo(196, 5);
  });

  test("stacks fixed c/L + % cashback for a lower effective price than either alone", () => {
    const res = applyToStation(stationFixture(), 220, [
      mk({ id: "d1", value: 4 }),
      mk({ id: "d2", type: "percent_cashback", value: 2 }),
    ]);
    // 220 - 4 = 216, then * 0.98 = 211.68
    expect(res.effectiveCpl).toBeCloseTo(211.68, 2);
    expect(res.applied).toHaveLength(2);
  });

  // ── Brand filter ─────────────────────────────────────────────────────
  test("applies discount when station.brand is in discount.brands", () => {
    const res = applyToStation(stationFixture({ brand: "Shell" }), 220, [
      mk({ brands: ["Shell", "BP"] }),
    ]);
    expect(res.effectiveCpl).toBeCloseTo(216, 5);
  });

  test("skips discount when station.brand is NOT in discount.brands", () => {
    const res = applyToStation(stationFixture({ brand: "United" }), 220, [
      mk({ brands: ["Shell", "BP"] }),
    ]);
    expect(res.effectiveCpl).toBe(220);
    expect(res.applied).toEqual([]);
  });

  test("empty brands[] means any brand matches", () => {
    const res = applyToStation(stationFixture({ brand: "Little Known Servo" }), 220, [
      mk({ brands: [] }),
    ]);
    expect(res.effectiveCpl).toBeCloseTo(216, 5);
  });

  // ── State filter ─────────────────────────────────────────────────────
  test("applies discount when station.state is in discount.states", () => {
    const res = applyToStation(stationFixture({ state: "NT" }), 220, [
      mk({ states: ["NT"] }),
    ]);
    expect(res.effectiveCpl).toBeCloseTo(216, 5);
  });

  test("skips discount when station.state is NOT in discount.states", () => {
    const res = applyToStation(stationFixture({ state: "QLD" }), 220, [
      mk({ states: ["NT"] }),
    ]);
    expect(res.effectiveCpl).toBe(220);
  });

  // ── AND semantics: all filters must match ────────────────────────────
  test("AND: brand matches but state doesn't → skip", () => {
    const res = applyToStation(stationFixture({ brand: "United", state: "QLD" }), 220, [
      mk({ brands: ["United"], states: ["NT"] }), // AANT-in-NT pattern
    ]);
    expect(res.effectiveCpl).toBe(220);
  });

  test("AND: state matches but brand doesn't → skip", () => {
    const res = applyToStation(stationFixture({ brand: "Shell", state: "NT" }), 220, [
      mk({ brands: ["United"], states: ["NT"] }),
    ]);
    expect(res.effectiveCpl).toBe(220);
  });

  test("AND: both match → apply", () => {
    const res = applyToStation(stationFixture({ brand: "United", state: "NT" }), 220, [
      mk({ brands: ["United"], states: ["NT"] }),
    ]);
    expect(res.effectiveCpl).toBeCloseTo(216, 5);
  });

  test("ignores fixed-$ rebates (map popup has no fill-size context)", () => {
    const res = applyToStation(stationFixture(), 220, [
      mk({ type: "fixed_rebate", value: 5 }),
    ]);
    expect(res.effectiveCpl).toBe(220);
    expect(res.applied).toEqual([]);
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
