import { parseFrankfurter } from "../frankfurter";

describe("parseFrankfurter", () => {
  it("extracts USD rate from a valid response", () => {
    const payload = {
      amount: 1,
      base: "AUD",
      date: "2026-04-16",
      rates: { USD: 0.71364 },
    };
    expect(parseFrankfurter(payload)).toBe(0.71364);
  });

  it("throws when response is not an object", () => {
    expect(() => parseFrankfurter(null)).toThrow("not an object");
    expect(() => parseFrankfurter("string")).toThrow("not an object");
  });

  it("throws when rates object is missing", () => {
    expect(() => parseFrankfurter({ amount: 1, base: "AUD" })).toThrow(
      "missing rates",
    );
  });

  it("throws when USD is not a number", () => {
    expect(() => parseFrankfurter({ rates: {} })).toThrow("not a number");
    expect(() => parseFrankfurter({ rates: { USD: "0.71" } })).toThrow(
      "not a number",
    );
  });

  it("throws when USD is out of sane range", () => {
    expect(() => parseFrankfurter({ rates: { USD: 0.05 } })).toThrow(
      "out of range",
    );
    expect(() => parseFrankfurter({ rates: { USD: 5.0 } })).toThrow(
      "out of range",
    );
  });

  it("accepts boundary values", () => {
    expect(parseFrankfurter({ rates: { USD: 0.5 } })).toBe(0.5);
    expect(parseFrankfurter({ rates: { USD: 1.2 } })).toBe(1.2);
  });
});
