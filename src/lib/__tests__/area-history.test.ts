import { aggregateAreaDay } from "@/lib/history";

describe("aggregateAreaDay", () => {
  const day = {
    s1: { U91: 150.1, DL: 170.0 },
    s2: { U91: 160.5 },
    s3: { U91: 155.9, P95: 180.0 },
    s4: { DL: 165.0 }, // no U91
  };

  it("averages and mins the requested ids for the fuel", () => {
    const r = aggregateAreaDay(day, ["s1", "s2", "s3"], "U91");
    // (150.1 + 160.5 + 155.9) / 3 = 155.5
    expect(r.avg).toBe(155.5);
    expect(r.min).toBe(150.1);
  });

  it("ignores ids missing that fuel", () => {
    const r = aggregateAreaDay(day, ["s1", "s4"], "U91");
    // only s1 has U91
    expect(r.avg).toBe(150.1);
    expect(r.min).toBe(150.1);
  });

  it("returns nulls when no id has data", () => {
    expect(aggregateAreaDay(day, ["s4"], "U91")).toEqual({ avg: null, min: null });
    expect(aggregateAreaDay(day, [], "U91")).toEqual({ avg: null, min: null });
  });

  it("returns nulls for a missing/blank day blob", () => {
    expect(aggregateAreaDay(null, ["s1"], "U91")).toEqual({ avg: null, min: null });
  });

  it("rounds the average to one decimal", () => {
    const r = aggregateAreaDay({ a: { U91: 100.0 }, b: { U91: 100.05 } }, ["a", "b"], "U91");
    expect(r.avg).toBe(100.0); // (100 + 100.05)/2 = 100.025 -> 100.0
  });
});
