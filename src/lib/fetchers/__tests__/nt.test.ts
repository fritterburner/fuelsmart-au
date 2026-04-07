import { fetchNTStations } from "../nt";

// Integration test — hits the real API
// Run with: npx jest src/lib/fetchers/__tests__/nt.test.ts
describe("fetchNTStations", () => {
  it("fetches and normalises NT stations", async () => {
    const stations = await fetchNTStations();
    expect(stations.length).toBeGreaterThan(100);

    const station = stations.find((s) => s.prices.length > 0)!;
    expect(station).toBeDefined();
    expect(station.id).toMatch(/^nt-\d+$/);
    expect(station.state).toBe("NT");
    expect(station.lat).toBeLessThan(0); // southern hemisphere
    expect(station.lng).toBeGreaterThan(100);
    expect(station.prices[0].price).toBeGreaterThan(50);
    expect(station.prices[0].price).toBeLessThan(500);
    expect(station.prices[0].fuel).toMatch(/^(U91|DL|P95|P98|E10|PD|LPG|E85|LAF)$/);
  }, 30000);
});
