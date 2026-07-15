import { classifyDirection, DirectionPoint } from "../cycle-direction";

function hist(values: (number | null)[]): DirectionPoint[] {
  return values.map((v, i) => ({ date: `2026-06-${String(i + 1).padStart(2, "0")}`, value: v }));
}

describe("classifyDirection", () => {
  it("returns null with fewer than 4 real data points", () => {
    expect(classifyDirection(hist([180, null, null]))).toBeNull();
    expect(classifyDirection([])).toBeNull();
  });

  it("classifies a clear upward run as rising", () => {
    const r = classifyDirection(hist([180, 182, 184, 186, 188, 190, 192]));
    expect(r?.direction).toBe("rising");
    expect(r?.label).toBe("Rising");
  });

  it("classifies a clear downward run as falling", () => {
    const r = classifyDirection(hist([192, 190, 188, 186, 184, 182, 180]));
    expect(r?.direction).toBe("falling");
  });

  it("classifies a flat run as steady", () => {
    const r = classifyDirection(hist([190, 190.01, 189.99, 190, 190.02, 189.98, 190]));
    expect(r?.direction).toBe("steady");
  });

  it("skips null days rather than treating them as zero", () => {
    const r = classifyDirection(hist([null, 180, null, 182, 184, null, 186, 188]));
    expect(r?.direction).toBe("rising");
  });

  it("flags near-the-bottom and near-the-top of a 28-day cycle", () => {
    // 28 days grinding down to a trough -> currently at the bottom.
    const troughValues = Array.from({ length: 28 }, (_, i) => 210 - i); // 210..183
    const atTrough = classifyDirection(hist(troughValues));
    expect(atTrough?.phaseHint).toMatch(/bottom/i);

    // 28 days climbing to a peak -> currently at the top.
    const peakValues = Array.from({ length: 28 }, (_, i) => 183 + i); // 183..210
    const atPeak = classifyDirection(hist(peakValues));
    expect(atPeak?.phaseHint).toMatch(/top/i);
  });

  it("omits a phase hint with fewer than 8 days of history", () => {
    const r = classifyDirection(hist([180, 182, 184, 186, 188]));
    expect(r?.phaseHint).toBeNull();
  });
});
