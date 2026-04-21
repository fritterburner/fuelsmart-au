import { isRealisticPrice, PRICE_MIN_CPL, PRICE_MAX_CPL } from "../price-sanity";

describe("isRealisticPrice", () => {
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
