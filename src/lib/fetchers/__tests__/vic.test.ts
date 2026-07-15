import { fetchVICStations } from "../vic";

/**
 * Fixture-based tests against the confirmed Fair Fuel Open Data API v1.0
 * spec (Service Victoria PDF, Oct 2025) — no network. global.fetch is mocked
 * per-URL so both the /fuel/prices call and the /fuel/reference-data/brands
 * join are exercised together, the way fetchVICStations actually calls them.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as Response;
}

const pricesFixture = {
  fuelPriceDetails: [
    {
      fuelStation: {
        id: 1001,
        name: "Servo One",
        brandId: 5,
        address: "1 Test St, Melbourne VIC 3000",
        location: { latitude: -37.8136, longitude: 144.9631 },
      },
      fuelPrices: [
        { fuelType: "U91", price: 189.9, isAvailable: true, updatedAt: "2026-07-14T10:00:00Z" },
        { fuelType: "DSL", price: 195.5, isAvailable: false, updatedAt: "2026-07-14T10:00:00Z" }, // dropped: unavailable
        { fuelType: "CNG", price: 120.0, isAvailable: true, updatedAt: "2026-07-14T10:00:00Z" }, // dropped: unsupported code
        { fuelType: "P98", price: 5.0, isAvailable: true, updatedAt: "2026-07-14T10:00:00Z" }, // dropped: sanity floor
      ],
      updatedAt: "2026-07-14T10:00:00Z",
    },
    {
      fuelStation: {
        id: 1002,
        name: "Servo Two",
        brandId: 999, // not present in the brands fixture
        address: "2 Test St, Geelong VIC 3220",
        location: { latitude: -38.1499, longitude: 144.3617 },
      },
      fuelPrices: [
        { fuelType: "PDSL", price: 199.9, isAvailable: true, updatedAt: "2026-07-14T09:00:00Z" },
      ],
      updatedAt: "2026-07-14T09:00:00Z",
    },
  ],
};

const brandsFixture = { brands: [{ id: 5, name: "Shell" }] };

describe("fetchVICStations", () => {
  const ORIGINAL_ENV = process.env;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, VIC_SERVO_SAVER_API_KEY: "test-key" };
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    jest.resetAllMocks();
  });

  function setupFetch(brandsOk = true) {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/fuel/reference-data/brands")) {
        return Promise.resolve(jsonResponse(brandsFixture, brandsOk, brandsOk ? 200 : 500));
      }
      if (url.includes("/fuel/prices")) {
        return Promise.resolve(jsonResponse(pricesFixture));
      }
      return Promise.reject(new Error(`unexpected URL ${url}`));
    });
  }

  it("parses stations, filters unavailable/unsupported/unsanitary prices, and joins brand", async () => {
    setupFetch(true);
    const stations = await fetchVICStations();
    expect(stations).toHaveLength(2);

    const s1 = stations.find((s) => s.id === "vic-1001")!;
    expect(s1.brand).toBe("Shell");
    expect(s1.suburb).toBe("");
    expect(s1.postcode).toBe("");
    expect(s1.address).toBe("1 Test St, Melbourne VIC 3000");
    expect(s1.prices).toHaveLength(1);
    expect(s1.prices[0]).toEqual({
      fuel: "U91",
      price: 189.9,
      updated: new Date("2026-07-14T10:00:00Z").toISOString(),
    });

    const s2 = stations.find((s) => s.id === "vic-1002")!;
    expect(s2.brand).toBe("Independent"); // brandId 999 unresolved against the brands fixture
    expect(s2.prices).toHaveLength(1);
    expect(s2.prices[0].fuel).toBe("PD"); // PDSL -> premium diesel
  });

  it("tolerates a failed/missing brands reference and falls back to Independent for every station", async () => {
    setupFetch(false);
    const stations = await fetchVICStations();
    expect(stations).toHaveLength(2);
    expect(stations.every((s) => s.brand === "Independent")).toBe(true);
  });

  it("sends x-consumer-id, a fresh UUIDv4 x-transactionid per request, and a User-Agent", async () => {
    setupFetch(true);
    await fetchVICStations();

    const priceCall = fetchMock.mock.calls.find(([url]) => String(url).includes("/fuel/prices"))!;
    const brandsCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes("/fuel/reference-data/brands")
    )!;

    const priceHeaders = priceCall[1].headers as Record<string, string>;
    const brandsHeaders = brandsCall[1].headers as Record<string, string>;

    expect(priceHeaders["x-consumer-id"]).toBe("test-key");
    expect(priceHeaders["x-transactionid"]).toMatch(UUID_RE);
    expect(priceHeaders["User-Agent"]).toBe("FuelSmart-AU/1.0");

    expect(brandsHeaders["x-transactionid"]).toMatch(UUID_RE);
    // A fresh transaction id must be generated per request, not reused.
    expect(brandsHeaders["x-transactionid"]).not.toBe(priceHeaders["x-transactionid"]);
  });

  it("surfaces a distinct error message on 403 (bad key)", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({}, false, 403)));
    await expect(fetchVICStations()).rejects.toThrow(/403/);
  });

  it("surfaces a distinct error message on 429 (rate limited)", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({}, false, 429)));
    await expect(fetchVICStations()).rejects.toThrow(/429|rate limit/i);
  });

  it("throws when VIC_SERVO_SAVER_API_KEY isn't configured", async () => {
    delete process.env.VIC_SERVO_SAVER_API_KEY;
    setupFetch(true);
    await expect(fetchVICStations()).rejects.toThrow(/VIC_SERVO_SAVER_API_KEY/);
  });
});
