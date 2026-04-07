import { planTrip } from "../trip-planner";
import { Station } from "../types";

function makeStation(id: string, lat: number, lng: number, price: number): Station {
  return {
    id, name: id, brand: "Test", brandCode: "T",
    address: "1 Test St", suburb: "Test", state: "NT",
    postcode: "0800", lat, lng,
    prices: [{ fuel: "U91", price, updated: new Date().toISOString() }],
  };
}

describe("planTrip", () => {
  it("plans stops along a simple route", () => {
    // Simulate a 1000km north-south route
    const geometry: [number, number][] = Array.from({ length: 100 }, (_, i) => [
      -12 - i * 0.1, // lat goes south
      131, // constant lng
    ]);

    const stations = [
      makeStation("cheap-start", -12.5, 131.0, 220),   // 50km in
      makeStation("expensive", -15.0, 131.0, 310),      // 300km in
      makeStation("cheap-mid", -17.0, 131.0, 225),      // 500km in
      makeStation("expensive-2", -19.0, 131.0, 300),    // 700km in
      makeStation("cheap-end", -20.5, 131.0, 218),      // 850km in
    ];

    const plan = planTrip({
      fuel: "U91",
      tankSize: 45,
      consumption: 10.5,
      jerryCapacity: 42,
      routeGeometry: geometry,
      stations,
      totalDistance: 1000,
    });

    expect(plan.stops.length).toBeGreaterThan(0);
    expect(plan.totalFuelCost).toBeGreaterThan(0);
    expect(plan.savings).toBeGreaterThanOrEqual(0);
    expect(plan.warnings.length).toBe(0);

    // Should prefer cheaper stations
    const stopPrices = plan.stops.map((s) => s.pricePerLitre);
    const avgStopPrice = stopPrices.reduce((a, b) => a + b, 0) / stopPrices.length;
    expect(avgStopPrice).toBeLessThan(280); // should avoid the 310 and 300 stops
  });

  it("warns when route has unreachable gaps", () => {
    const geometry: [number, number][] = Array.from({ length: 100 }, (_, i) => [
      -12 - i * 0.2, 131,
    ]);

    // Only one station, 1500km away — unreachable on 87L
    const stations = [makeStation("far", -27.0, 131.0, 220)];

    const plan = planTrip({
      fuel: "U91",
      tankSize: 45,
      consumption: 10.5,
      jerryCapacity: 0,
      routeGeometry: geometry,
      stations,
      totalDistance: 2000,
    });

    expect(plan.warnings.length).toBeGreaterThan(0);
  });
});
