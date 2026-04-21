import {
  CANONICAL_BRANDS,
  normaliseBrand,
  isCanonicalBrand,
} from "../brands";

describe("CANONICAL_BRANDS", () => {
  it("includes the majors users will look for by name", () => {
    const names = CANONICAL_BRANDS as readonly string[];
    for (const expected of [
      "7-Eleven",
      "Ampol",
      "BP",
      "Caltex",
      "Coles Express",
      "Mobil",
      "Puma Energy",
      "Shell",
      "United",
    ]) {
      expect(names).toContain(expected);
    }
  });

  it("contains no duplicates", () => {
    const seen = new Set<string>();
    for (const b of CANONICAL_BRANDS) {
      expect(seen.has(b)).toBe(false);
      seen.add(b);
    }
  });
});

describe("normaliseBrand", () => {
  it("returns canonical name unchanged", () => {
    expect(normaliseBrand("Shell")).toBe("Shell");
    expect(normaliseBrand("7-Eleven")).toBe("7-Eleven");
    expect(normaliseBrand("Coles Express")).toBe("Coles Express");
  });

  it("is case-insensitive for exact canonical match", () => {
    expect(normaliseBrand("SHELL")).toBe("Shell");
    expect(normaliseBrand("shell")).toBe("Shell");
    expect(normaliseBrand("bp")).toBe("BP");
    expect(normaliseBrand("7-eleven")).toBe("7-Eleven");
  });

  it("maps Coles Express variants to the canonical name", () => {
    expect(normaliseBrand("ColesExpress")).toBe("Coles Express");
    expect(normaliseBrand("Coles  Express")).toBe("Coles Express");
    expect(normaliseBrand("Shell Coles Express")).toBe("Coles Express");
    expect(normaliseBrand("COLES EXPRESS")).toBe("Coles Express");
  });

  it("maps Caltex Woolworths variants correctly", () => {
    expect(normaliseBrand("Caltex Woolworths")).toBe("Caltex Woolworths");
    expect(normaliseBrand("CaltexWoolworths")).toBe("Caltex Woolworths");
    expect(normaliseBrand("CALTEX WOOLIES")).toBe("Caltex Woolworths");
  });

  it("maps Ampol variants (including legacy Caltex rebrand)", () => {
    expect(normaliseBrand("Ampol")).toBe("Ampol");
    expect(normaliseBrand("AMPOL")).toBe("Ampol");
    expect(normaliseBrand("EG Ampol")).toBe("EG Ampol");
    expect(normaliseBrand("EgAmpol")).toBe("EG Ampol");
  });

  it("trims whitespace", () => {
    expect(normaliseBrand("  Shell  ")).toBe("Shell");
    expect(normaliseBrand("\tBP\n")).toBe("BP");
  });

  it("returns the raw string (title-cased) when no match is known", () => {
    // We want stations to keep a human-readable name even if we don't
    // recognise the brand — just not a canonical one.
    expect(normaliseBrand("Bob's Servo")).toBe("Bob's Servo");
    expect(normaliseBrand("Some Unknown Chain")).toBe("Some Unknown Chain");
  });

  it("handles empty input defensively", () => {
    expect(normaliseBrand("")).toBe("");
    expect(normaliseBrand("   ")).toBe("");
  });
});

describe("isCanonicalBrand", () => {
  it("returns true for names in CANONICAL_BRANDS", () => {
    expect(isCanonicalBrand("Shell")).toBe(true);
    expect(isCanonicalBrand("7-Eleven")).toBe(true);
  });

  it("returns false for unknown names", () => {
    expect(isCanonicalBrand("Bob's Servo")).toBe(false);
    expect(isCanonicalBrand("")).toBe(false);
  });
});
