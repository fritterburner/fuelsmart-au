import { regionOf, nearestRegion, regionsForState, isValidRegion, regionById } from "../regions";
import { Station, StateCode } from "../types";

function at(state: StateCode, lat: number, lng: number): Station {
  return {
    id: "x",
    name: "x",
    brand: "Test",
    brandCode: "T",
    address: "1 Test St",
    suburb: "",
    state,
    postcode: "",
    lat,
    lng,
    prices: [],
  };
}

describe("regionOf", () => {
  it("classifies metro and regional hubs", () => {
    expect(regionOf(at("NSW", -33.87, 151.21))).toBe("nsw-sydney"); // CBD
    expect(regionOf(at("NSW", -32.93, 151.78))).toBe("nsw-newcastle"); // Newcastle
    expect(regionOf(at("QLD", -16.92, 145.77))).toBe("qld-cairns");
  });

  it("falls back to Rest of <state> beyond every catchment", () => {
    expect(regionOf(at("NSW", -31.95, 141.47))).toBe("nsw-rest"); // Broken Hill
  });

  it("treats ACT as a single region", () => {
    expect(regionOf(at("ACT", -35.28, 149.13))).toBe("act");
  });

  it("does not assign across state borders (Albury vs Wodonga)", () => {
    // ~5 km apart, opposite sides of the Murray.
    expect(regionOf(at("NSW", -36.08, 146.92))).toBe("nsw-border");
    expect(regionOf(at("VIC", -36.12, 146.89))).toBe("vic-wodonga");
  });

  it("falls back to Rest on missing coords", () => {
    expect(regionOf(at("WA", 0, 0))).toBe("wa-rest");
  });
});

describe("nearestRegion (for the map-centre default)", () => {
  it("resolves a point to the nearest anchor", () => {
    expect(nearestRegion(-27.47, 153.03)).toBe("qld-brisbane");
    expect(nearestRegion(-37.81, 144.96)).toBe("vic-melbourne");
  });
  it("returns null for junk coords", () => {
    expect(nearestRegion(0, 0)).toBeNull();
  });
});

describe("registry", () => {
  it("lists a state's regions metro-first, rest-last", () => {
    const nsw = regionsForState("NSW");
    expect(nsw[0].kind).toBe("metro");
    expect(nsw[nsw.length - 1].kind).toBe("rest");
    expect(nsw.every((r) => r.state === "NSW")).toBe(true);
  });
  it("validates region ids", () => {
    expect(isValidRegion("nsw-sydney")).toBe(true);
    expect(isValidRegion("nsw-rest")).toBe(true);
    expect(isValidRegion("act")).toBe(true);
    expect(isValidRegion("nope")).toBe(false);
    expect(regionById("qld-gold-coast")?.label).toBe("Gold Coast");
  });
});
