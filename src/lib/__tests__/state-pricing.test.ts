import { summariseStatePrices } from "../state-pricing";
import { Station, StationPrice } from "../types";

function station(id: string, prices: Partial<StationPrice>[]): Station {
  return {
    id,
    name: id,
    brand: "Test",
    brandCode: "T",
    address: "1 Test St",
    suburb: "Testville",
    state: "NSW",
    postcode: "2000",
    lat: -33.87,
    lng: 151.21,
    prices: prices.map((p) => ({ fuel: p.fuel!, price: p.price!, updated: p.updated ?? "2026-07-15T00:00:00.000Z" })),
  };
}

describe("summariseStatePrices", () => {
  it("ranks stations cheapest-first and computes the average", () => {
    const stations = [
      station("a", [{ fuel: "U91", price: 190.9 }]),
      station("b", [{ fuel: "U91", price: 175.5 }]),
      station("c", [{ fuel: "U91", price: 182.0 }]),
    ];
    const s = summariseStatePrices(stations, "U91");

    expect(s.stationCount).toBe(3);
    expect(s.cheapest.map((p) => p.station.id)).toEqual(["b", "c", "a"]);
    expect(s.min).toBe(175.5);
    expect(s.max).toBe(190.9);
    expect(s.average).toBeCloseTo((190.9 + 175.5 + 182.0) / 3, 1);
    expect(s.activeFuel).toBe("U91");
    expect(s.fallbackNotice).toBeNull();
  });

  it("caps the cheapest list at the requested limit", () => {
    const stations = Array.from({ length: 15 }, (_, i) => station(`s${i}`, [{ fuel: "U91", price: 170 + i }]));
    const s = summariseStatePrices(stations, "U91", 10);
    expect(s.cheapest).toHaveLength(10);
    expect(s.stationCount).toBe(15);
  });

  it("falls back to LAF when no station reports U91", () => {
    const stations = [station("a", [{ fuel: "LAF", price: 200 }]), station("b", [{ fuel: "DL", price: 195 }])];
    const s = summariseStatePrices(stations, "U91");

    expect(s.activeFuel).toBe("LAF");
    expect(s.stationCount).toBe(1);
    expect(s.fallbackNotice).toMatch(/LAF|Low Aromatic/i);
  });

  it("returns an empty summary when nothing matches and there's no fallback", () => {
    const stations = [station("a", [{ fuel: "LPG", price: 100 }])];
    const s = summariseStatePrices(stations, "P98");

    expect(s.stationCount).toBe(0);
    expect(s.cheapest).toHaveLength(0);
    expect(s.average).toBeNull();
    expect(s.min).toBeNull();
  });

  it("picks the lowest price when a station lists the same fuel twice", () => {
    const stations = [
      station("a", [
        { fuel: "U91", price: 195 },
        { fuel: "U91", price: 189 },
      ]),
    ];
    const s = summariseStatePrices(stations, "U91");
    expect(s.cheapest[0].price).toBe(189);
  });
});
