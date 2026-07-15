import { findNearbyCheaper } from "../station-detail";
import { Station } from "../types";

function station(id: string, lat: number, lng: number, price: number, state: Station["state"] = "NSW"): Station {
  return {
    id,
    name: id,
    brand: "Test",
    brandCode: "T",
    address: "1 Test St",
    suburb: "Testville",
    state,
    postcode: "2000",
    lat,
    lng,
    prices: [{ fuel: "U91", price, updated: "2026-07-15T00:00:00.000Z" }],
  };
}

describe("findNearbyCheaper", () => {
  // Sydney CBD as the origin; ~0.01deg lat is roughly 1.1km.
  const target = station("target", -33.87, 151.21, 190.0);

  it("only returns stations that are both cheaper and within the radius", () => {
    const near = station("near", -33.875, 151.21, 180.0); // ~0.6km, cheaper
    const far = station("far", -34.1, 151.21, 170.0); // ~26km, cheaper but too far
    const expensiveNear = station("expensive", -33.872, 151.21, 195.0); // near but pricier

    const result = findNearbyCheaper(target, [target, near, far, expensiveNear], "U91");
    expect(result.map((r) => r.station.id)).toEqual(["near"]);
  });

  it("excludes the target station itself", () => {
    const result = findNearbyCheaper(target, [target], "U91");
    expect(result).toHaveLength(0);
  });

  it("ignores stations without the requested fuel", () => {
    const noFuel: Station = { ...station("no-fuel", -33.871, 151.21, 0), prices: [] };
    const result = findNearbyCheaper(target, [target, noFuel], "U91");
    expect(result).toHaveLength(0);
  });

  it("stays within the same state", () => {
    const crossBorder = station("act-station", -33.871, 151.211, 150.0, "ACT");
    const result = findNearbyCheaper(target, [target, crossBorder], "U91");
    expect(result).toHaveLength(0);
  });

  it("sorts cheapest first and respects the limit", () => {
    const a = station("a", -33.871, 151.21, 185.0);
    const b = station("b", -33.872, 151.21, 180.0);
    const c = station("c", -33.873, 151.21, 175.0);
    const result = findNearbyCheaper(target, [target, a, b, c], "U91", 5, 2);
    expect(result.map((r) => r.station.id)).toEqual(["c", "b"]);
  });

  it("returns nothing when the target itself has no price for that fuel", () => {
    const noTargetFuel: Station = { ...target, prices: [] };
    const near = station("near", -33.871, 151.21, 100.0);
    const result = findNearbyCheaper(noTargetFuel, [noTargetFuel, near], "U91");
    expect(result).toHaveLength(0);
  });
});
