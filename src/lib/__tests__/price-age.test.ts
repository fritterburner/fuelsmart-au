import { isPriceCurrent, parsePriceTime, priceAgeDays } from "../price-age";

describe("price-age", () => {
  const now = Date.parse("2026-10-30T00:00:00Z");
  it("treats a zone-less timestamp as UTC (QLD TransactionDateUtc)", () => {
    expect(parsePriceTime("2026-10-29T03:10:00.2")).toBe(Date.parse("2026-10-29T03:10:00.2Z"));
    expect(parsePriceTime("2026-10-29T03:10:00Z")).toBe(Date.parse("2026-10-29T03:10:00Z"));
    expect(parsePriceTime("2026-10-29T13:10:00+10:00")).toBe(Date.parse("2026-10-29T03:10:00Z"));
  });
  it("ages prices in days", () => {
    expect(priceAgeDays({ fuel: "U91", price: 200, updated: "2026-10-28T00:00:00Z" }, now)).toBeCloseTo(2);
    expect(priceAgeDays({ fuel: "U91", price: 200, updated: "garbage" }, now)).toBe(Infinity);
  });
  it("applies per-state limits", () => {
    const sixDays = { fuel: "U91" as const, price: 200, updated: "2026-10-24T00:00:00Z" };
    expect(isPriceCurrent(sixDays, "QLD", now)).toBe(true);
    expect(isPriceCurrent(sixDays, "NT", now)).toBe(false);
    const old = { fuel: "U91" as const, price: 174.9, updated: "2025-09-10T01:35:37.357" };
    expect(isPriceCurrent(old, "QLD", now)).toBe(false);
  });
});
