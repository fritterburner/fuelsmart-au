import { isRealisticPrice, PRICE_MIN_CPL, PRICE_MAX_CPL } from "../price-sanity";

describe("isRealisticPrice (no fuel — global bounds)", () => {
  it("accepts typical Australian pump prices", () => {
    expect(isRealisticPrice(149.9)).toBe(true);
    expect(isRealisticPrice(220)).toBe(true);
    expect(isRealisticPrice(203.4)).toBe(true);
  });

  it("rejects the 999.9 sentinel commonly meaning 'no data'", () => {
    expect(isRealisticPrice(999.9)).toBe(false);
    expect(isRealisticPrice(9999)).toBe(false);
  });

  it("rejects 0 and negatives", () => {
    expect(isRealisticPrice(0)).toBe(false);
    expect(isRealisticPrice(-10)).toBe(false);
  });

  it("rejects NaN / non-finite values", () => {
    expect(isRealisticPrice(NaN)).toBe(false);
    expect(isRealisticPrice(Infinity)).toBe(false);
    expect(isRealisticPrice(-Infinity)).toBe(false);
  });

  it("accepts the documented min and max bounds", () => {
    expect(isRealisticPrice(PRICE_MIN_CPL)).toBe(true);
    expect(isRealisticPrice(PRICE_MAX_CPL)).toBe(true);
  });

  it("rejects values just outside the bounds", () => {
    expect(isRealisticPrice(PRICE_MIN_CPL - 0.01)).toBe(false);
    expect(isRealisticPrice(PRICE_MAX_CPL + 0.01)).toBe(false);
  });
});

describe("isRealisticPrice (per-fuel floors)", () => {
  it("rejects the 31.7 c/L diesel outlier that a tenths-of-a-cent decimal slip produces", () => {
    // The reproducer from production: PetrolSpy showed 348.7 c/L diesel at a
    // marina, our feed showed 31.7. Per-fuel floor must catch this.
    expect(isRealisticPrice(31.7, "DL")).toBe(false);
  });

  it("rejects implausibly cheap petrol", () => {
    expect(isRealisticPrice(50, "U91")).toBe(false);
    expect(isRealisticPrice(70, "P95")).toBe(false);
    expect(isRealisticPrice(70, "P98")).toBe(false);
    expect(isRealisticPrice(70, "E10")).toBe(false);
    expect(isRealisticPrice(70, "PD")).toBe(false);
  });

  it("accepts realistic diesel and petrol prices", () => {
    expect(isRealisticPrice(180, "DL")).toBe(true);
    expect(isRealisticPrice(348.7, "DL")).toBe(true);
    expect(isRealisticPrice(165, "U91")).toBe(true);
    expect(isRealisticPrice(220, "P98")).toBe(true);
  });

  it("accepts genuinely cheap LPG that would fail the petrol floor", () => {
    // LPG has been ~50 c/L in regional markets — global floor of 80 would
    // reject these legitimately.
    expect(isRealisticPrice(55, "LPG")).toBe(true);
    expect(isRealisticPrice(35, "LPG")).toBe(true);
  });

  it("rejects LPG below its dedicated floor", () => {
    expect(isRealisticPrice(15, "LPG")).toBe(false);
  });

  it("accepts E85 promo pricing", () => {
    expect(isRealisticPrice(75, "E85")).toBe(true);
  });

  it("still rejects sentinels regardless of fuel", () => {
    expect(isRealisticPrice(999.9, "DL")).toBe(false);
    expect(isRealisticPrice(999.9, "LPG")).toBe(false);
  });
});
