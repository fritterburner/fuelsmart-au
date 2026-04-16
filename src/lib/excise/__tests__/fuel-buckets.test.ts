import { toFuelBucket } from "../fuel-buckets";

describe("toFuelBucket", () => {
  it.each(["U91", "E10", "P95", "P98"] as const)("%s → ULP", (code) => {
    expect(toFuelBucket(code)).toBe("ULP");
  });

  it.each(["DL", "PD"] as const)("%s → DIESEL", (code) => {
    expect(toFuelBucket(code)).toBe("DIESEL");
  });

  it.each(["LPG", "E85", "LAF"] as const)("%s → NA", (code) => {
    expect(toFuelBucket(code)).toBe("NA");
  });
});
