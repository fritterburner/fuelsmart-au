import { fetchQLDStations } from "../qld";

describe("fetchQLDStations", () => {
  it("fetches and normalises QLD stations", async () => {
    const stations = await fetchQLDStations();
    expect(stations.length).toBeGreaterThan(1000);

    const withPrices = stations.filter((s) => s.prices.length > 0);
    expect(withPrices.length).toBeGreaterThan(500);

    const station = withPrices[0];
    expect(station.id).toMatch(/^qld-\d+$/);
    expect(station.state).toBe("QLD");
    expect(station.lat).toBeLessThan(0);
    expect(station.lng).toBeGreaterThan(100);
    expect(station.prices[0].price).toBeGreaterThan(50);
    expect(station.prices[0].price).toBeLessThan(500);
  }, 30000);
});
