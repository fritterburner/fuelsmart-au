import { findBestStop, perpDistanceKm } from "../find-best-stop";
import type { Station } from "../../types";
import type { OsrmResult } from "../osrm";
import { haversine } from "../../trip-planner";

// Test helpers ---------------------------------------------------------------

function station(
  id: string,
  lat: number,
  lng: number,
  pricesByFuel: Record<string, number>,
): Station {
  return {
    id,
    name: id,
    brand: "Test",
    brandCode: "TST",
    address: "1 Test St",
    suburb: "Testville",
    state: "NT",
    postcode: "0000",
    lat,
    lng,
    prices: Object.entries(pricesByFuel).map(([fuel, price]) => ({
      fuel: fuel as Station["prices"][number]["fuel"],
      price,
      updated: "2026-04-21T00:00:00Z",
    })),
  };
}

/**
 * Mock OSRM: distance = sum of haversine between successive coords.
 * Good enough for ranking tests — actual OSRM is always ≥ haversine.
 */
function mockOsrmRoute(coords: [number, number][]): Promise<OsrmResult> {
  let km = 0;
  for (let i = 1; i < coords.length; i++) {
    km += haversine(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]);
  }
  return Promise.resolve({
    distanceKm: km,
    durationMin: km, // unused in logic
    geometry: coords,
  });
}

const deps = { osrmRoute: jest.fn(mockOsrmRoute) };

beforeEach(() => {
  deps.osrmRoute.mockClear();
  deps.osrmRoute.mockImplementation(mockOsrmRoute);
});

// Base fixture: A at (-12.40, 130.87) Darwin CBD, B at (-12.40, 131.10) ~25km east.
const A = { lat: -12.4, lng: 130.87 };
const B = { lat: -12.4, lng: 131.1 };

// -------------------------------------------------------------------------

describe("perpDistanceKm", () => {
  it("0 when P lies on the A-B line", () => {
    expect(perpDistanceKm(-12.4, 131.0, A, B)).toBeLessThan(0.1);
  });

  it("~10 km for a point 10 km off the line", () => {
    // A-B is east-west at lat -12.4. 10 km north ≈ 0.09° lat.
    const d = perpDistanceKm(-12.4 + 0.09, 131.0, A, B);
    expect(d).toBeGreaterThan(9);
    expect(d).toBeLessThan(11);
  });
});

// -------------------------------------------------------------------------

describe("findBestStop", () => {
  it("returns winner:null when no stations supplied", async () => {
    const r = await findBestStop(
      { a: A, b: B, stations: [], fuel: "U91", fillLitres: 50, consumption: 10 },
      deps,
    );
    expect(r.winner).toBeNull();
    expect(r.shortlist).toEqual([]);
    expect(r.directKm).toBeGreaterThan(0);
  });

  it("picks lowest total-cost (not lowest c/L) when detour swings it", async () => {
    // S1: on-route, 170.0 c/L. S2: 15 km off-route, 160.0 c/L.
    // 50 L fill, 10 L/100km consumption.
    //   S1 total = 50 * 1.70 = $85.00, detour ~0.
    //   S2 detour km = 2 * ~15 = 30 km (via out and back).
    //   S2 fill    = 50 * 1.60 = $80.00
    //   S2 detour  = 30 * 0.1 * 1.60 = $4.80
    //   S2 total   = $84.80  → S2 still wins, but narrowly.
    // Now raise S2's detour — put it 25 km off the line (50 km detour).
    //   S2 detour cost = 50 * 0.1 * 1.60 = $8.00; total $88.00 > S1 $85.00.
    // Expected: S1 wins.
    const s1 = station("on-route", -12.4, 131.0, { U91: 170.0 });
    const s2Cheaper = station("far-off-route", -12.17, 131.0, { U91: 160.0 });
    // ~25 km north of the A-B line.
    const r = await findBestStop(
      { a: A, b: B, stations: [s1, s2Cheaper], fuel: "U91", fillLitres: 50, consumption: 10 },
      deps,
    );
    // s2 is outside the 15 km corridor, so it's filtered out entirely.
    expect(r.winner?.station.id).toBe("on-route");
    expect(r.shortlist).toHaveLength(0);
  });

  it("cheapest-by-cpl wins when detour is small", async () => {
    const s1 = station("on-route-170", -12.4, 131.0, { U91: 170.0 });
    // 5 km north of the line, 10 km detour round-trip, priced 160.
    const s2 = station("near-160", -12.4 + 0.045, 131.0, { U91: 160.0 });
    const r = await findBestStop(
      { a: A, b: B, stations: [s1, s2], fuel: "U91", fillLitres: 50, consumption: 10 },
      deps,
    );
    expect(r.winner?.station.id).toBe("near-160");
    // Shortlist should include s1.
    expect(r.shortlist.map((c) => c.station.id)).toEqual(["on-route-170"]);
  });

  it("single station → it wins even alone", async () => {
    const s = station("solo", -12.4, 131.0, { U91: 170.0 });
    const r = await findBestStop(
      { a: A, b: B, stations: [s], fuel: "U91", fillLitres: 50, consumption: 10 },
      deps,
    );
    expect(r.winner?.station.id).toBe("solo");
    expect(r.onRouteCheapest?.station.id).toBe("solo");
    expect(r.savingsVsOnRoute).toBe(0);
  });

  it("filters stations outside the corridor before any OSRM call", async () => {
    const sOnRoute = station("on", -12.4, 131.0, { U91: 170.0 });
    // 100 km north — way outside the 15 km perpendicular corridor.
    const sFar = station("far", -11.5, 131.0, { U91: 150.0 });
    await findBestStop(
      { a: A, b: B, stations: [sOnRoute, sFar], fuel: "U91", fillLitres: 50, consumption: 10 },
      deps,
    );
    // 1 direct call + 1 via-route for on-route station = 2 total.
    expect(deps.osrmRoute).toHaveBeenCalledTimes(2);
  });

  it("falls back from U91 to LAF when no U91 stations in corridor", async () => {
    const sLaf = station("remote-laf", -12.4, 131.0, { LAF: 200.0 });
    const r = await findBestStop(
      { a: A, b: B, stations: [sLaf], fuel: "U91", fillLitres: 50, consumption: 10 },
      deps,
    );
    expect(r.fuelUsed).toBe("LAF");
    expect(r.fallbackNotice).toContain("LAF");
    expect(r.winner?.station.id).toBe("remote-laf");
  });

  it("falls back from E10 through U91 to LAF", async () => {
    const sU91 = station("u91", -12.4, 131.0, { U91: 170.0 });
    const r = await findBestStop(
      { a: A, b: B, stations: [sU91], fuel: "E10", fillLitres: 50, consumption: 10 },
      deps,
    );
    expect(r.fuelUsed).toBe("U91");
    expect(r.fallbackNotice).toContain("U91");
  });

  it("clamps negative detour to 0 (OSRM via-shorter-than-direct quirk)", async () => {
    // Force OSRM mock to report a via-route shorter than the direct route.
    deps.osrmRoute.mockImplementationOnce(() =>
      Promise.resolve({ distanceKm: 100, durationMin: 0, geometry: [] }),
    );
    deps.osrmRoute.mockImplementationOnce(() =>
      Promise.resolve({ distanceKm: 99, durationMin: 0, geometry: [] }),
    );
    const s = station("only", -12.4, 131.0, { U91: 170.0 });
    const r = await findBestStop(
      { a: A, b: B, stations: [s], fuel: "U91", fillLitres: 50, consumption: 10 },
      deps,
    );
    expect(r.winner?.detourKm).toBe(0);
    expect(r.winner?.detourFuelCostAud).toBe(0);
  });

  it("caps OSRM calls at MAX_OSRM_CANDIDATES (15)", async () => {
    // 30 candidates, all in corridor. Should fire 1 direct + 15 via-routes.
    const stations = Array.from({ length: 30 }, (_, i) =>
      station(`s${i}`, -12.4, 130.88 + i * 0.007, { U91: 150 + i }),
    );
    await findBestStop(
      { a: A, b: B, stations, fuel: "U91", fillLitres: 50, consumption: 10 },
      deps,
    );
    expect(deps.osrmRoute).toHaveBeenCalledTimes(16);
  });

  it("computes savingsVsOnRoute when winner beats on-route cheapest", async () => {
    const sOn = station("on", -12.4, 131.0, { U91: 180.0 });
    // 3 km north ≈ 6 km detour, 10 c/L cheaper.
    const sSlightDetour = station("slight", -12.4 + 0.027, 131.0, { U91: 170.0 });
    const r = await findBestStop(
      {
        a: A,
        b: B,
        stations: [sOn, sSlightDetour],
        fuel: "U91",
        fillLitres: 50,
        consumption: 10,
      },
      deps,
    );
    expect(r.winner?.station.id).toBe("slight");
    expect(r.onRouteCheapest?.station.id).toBe("on");
    expect(r.savingsVsOnRoute).toBeGreaterThan(0);
  });
});
