import { nearestBaseline, haversineKm } from "../nearest-baseline";
import { BASELINE_CITIES } from "../baselines";

describe("haversineKm", () => {
  it("returns 0 for identical points", () => {
    expect(haversineKm(-12.46, 130.84, -12.46, 130.84)).toBeCloseTo(0, 3);
  });

  it("computes approximate Sydney-Melbourne distance (~714 km)", () => {
    const sydney = BASELINE_CITIES.find((c) => c.name === "Sydney")!;
    const melbourne = BASELINE_CITIES.find((c) => c.name === "Melbourne")!;
    const d = haversineKm(sydney.lat, sydney.lng, melbourne.lat, melbourne.lng);
    expect(d).toBeGreaterThan(700);
    expect(d).toBeLessThan(730);
  });
});

describe("nearestBaseline", () => {
  it("Darwin CBD coords → Darwin, ~0km, high confidence", () => {
    const r = nearestBaseline(-12.4634, 130.8456);
    expect(r.city.name).toBe("Darwin");
    expect(r.distanceKm).toBeLessThan(1);
    expect(r.confidence).toBe("high");
  });

  it("Sydney Opera House coords → Sydney, <5km, high confidence", () => {
    const r = nearestBaseline(-33.8568, 151.2153);
    expect(r.city.name).toBe("Sydney");
    expect(r.distanceKm).toBeLessThan(5);
    expect(r.confidence).toBe("high");
  });

  it("Tennant Creek coords (between Katherine & Alice) → one of them, low confidence", () => {
    // Tennant Creek: -19.65, 134.19 — ~580km from Katherine, ~500km from Alice Springs
    const r = nearestBaseline(-19.65, 134.19);
    expect(["Alice Springs", "Katherine"]).toContain(r.city.name);
    expect(r.confidence).toBe("low");
    expect(r.distanceKm).toBeGreaterThan(150);
  });

  it("~100km from Brisbane → medium confidence", () => {
    // Point roughly 100km south-west of Brisbane
    const r = nearestBaseline(-28.1, 152.5);
    expect(r.confidence).toBe("medium");
    expect(r.distanceKm).toBeGreaterThan(50);
    expect(r.distanceKm).toBeLessThan(150);
  });

  it("exact baseline coords → 0km, high confidence", () => {
    const perth = BASELINE_CITIES.find((c) => c.name === "Perth")!;
    const r = nearestBaseline(perth.lat, perth.lng);
    expect(r.city.name).toBe("Perth");
    expect(r.distanceKm).toBeCloseTo(0, 3);
    expect(r.confidence).toBe("high");
  });
});
