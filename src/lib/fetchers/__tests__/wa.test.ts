import { fetchWAStations } from "../wa";

describe("fetchWAStations", () => {
  it("fetches and normalises WA stations", async () => {
    const stations = await fetchWAStations();
    expect(stations.length).toBeGreaterThan(500);

    const station = stations.find((s) => s.prices.length > 0)!;
    expect(station).toBeDefined();
    expect(station.id).toMatch(/^wa-/);
    expect(station.state).toBe("WA");
    expect(station.lat).toBeLessThan(0);
    expect(station.lng).toBeGreaterThan(100);
    expect(station.prices[0].price).toBeGreaterThan(50);
    expect(station.prices[0].price).toBeLessThan(500);
  }, 60000); // WA fetches 7 fuel types sequentially
});
