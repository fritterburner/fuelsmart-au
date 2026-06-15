import { planTrip, detourAdjustedCpl } from "../trip-planner";
import { Station } from "../types";

function makeStation(
  id: string,
  lat: number,
  lng: number,
  price: number
): Station {
  return {
    id,
    name: id,
    brand: "Test",
    brandCode: "T",
    address: "1 Test St",
    suburb: "Test",
    state: "NT",
    postcode: "0800",
    lat,
    lng,
    prices: [{ fuel: "U91", price, updated: new Date().toISOString() }],
  };
}

describe("detourAdjustedCpl", () => {
  it("returns the pump price unchanged for an on-route station", () => {
    expect(detourAdjustedCpl(200, 0, 10, 50)).toBe(200);
  });

  it("adds a surcharge proportional to the round-trip detour fuel", () => {
    // 8 km one-way detour, 10 km/L, amortised over a 40 L tank:
    // detourLitres = 2*8/10 = 1.6 L; surcharge = 1.6 * 200 / 40 = 8 c/L
    expect(detourAdjustedCpl(200, 8, 10, 40)).toBeCloseTo(208, 5);
  });

  it("guards against zero/negative inputs (penalty disabled)", () => {
    expect(detourAdjustedCpl(200, 8, 0, 40)).toBe(200);
    expect(detourAdjustedCpl(200, 8, 10, 0)).toBe(200);
    expect(detourAdjustedCpl(200, -5, 10, 40)).toBe(200);
  });
});

describe("trip planner — detour-aware station choice", () => {
  // 300 km route running due south along lng 131. One stop is forced ~halfway.
  const geometry: [number, number][] = Array.from({ length: 100 }, (_, i) => [
    -12 - i * 0.1,
    131,
  ]);

  // Two candidates at the same point along the route (~km 150): one sits on the
  // highway, the other ~8.5 km off it.
  const onRoute = (price: number) => makeStation("on-route", -17.0, 131.0, price);
  const offRoute = (price: number) => makeStation("off-route", -17.0, 131.08, price);

  function planWith(onPrice: number, offPrice: number) {
    return planTrip({
      fuel: "U91",
      tankSize: 20,
      consumption: 10, // 10 km/L -> ~200 km range, forces a stop before km 180
      jerryCapacity: 0,
      routeGeometry: geometry,
      stations: [onRoute(onPrice), offRoute(offPrice)],
      totalDistance: 300,
    });
  }

  it("keeps the on-route servo when the detour eats a small saving", () => {
    // Off-route is 3 c/L cheaper at the pump, but ~8.5 km off-route. The detour
    // surcharge (amortised over a 20 L tank) exceeds 3 c/L, so on-route wins.
    const plan = planWith(200, 197);
    expect(plan.stops.length).toBeGreaterThan(0);
    expect(plan.stops[0].station.id).toBe("on-route");
    expect(plan.stops[0].pricePerLitre).toBe(200);
  });

  it("takes the off-route servo when it is cheap enough to beat the detour", () => {
    // Now off-route is 40 c/L cheaper — easily worth the 8.5 km detour.
    const plan = planWith(200, 160);
    expect(plan.stops.length).toBeGreaterThan(0);
    expect(plan.stops[0].station.id).toBe("off-route");
    expect(plan.stops[0].pricePerLitre).toBe(160);
  });
});
