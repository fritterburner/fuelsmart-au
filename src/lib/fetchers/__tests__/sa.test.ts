/**
 * Fixture-based tests for the SA Informed Sources FPDAPI fetcher — no
 * network. sa.ts reads its config (countryId/geoRegion overrides) from
 * process.env at module-load time, matching how it actually runs in
 * production (Vercel env vars are fixed per cold start; changing them needs
 * a redeploy — see docs/go-live-sa-vic.md). Tests that need different env
 * values load a fresh module instance via jest.isolateModules().
 */

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as Response;
}

function loadSaModule(): typeof import("../sa") {
  let mod!: typeof import("../sa");
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    mod = require("../sa");
  });
  return mod;
}

const BP_BRAND = { Brands: [{ BrandId: 5, Name: "BP" }] };

describe("fetchSAStations", () => {
  const ORIGINAL_ENV = process.env;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, SA_FPIS_API_TOKEN: "test-token" };
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    jest.resetAllMocks();
  });

  function routeFetch(opts: {
    sites: unknown;
    prices: unknown;
    brands?: unknown;
    brandsOk?: boolean;
    fuelTypes?: unknown;
    fuelTypesOk?: boolean;
  }) {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("GetFullSiteDetails")) return Promise.resolve(jsonResponse(opts.sites));
      if (url.includes("GetSitesPrices")) return Promise.resolve(jsonResponse(opts.prices));
      if (url.includes("GetCountryBrands")) {
        return Promise.resolve(
          jsonResponse(opts.brands ?? BP_BRAND, opts.brandsOk ?? true, opts.brandsOk === false ? 500 : 200)
        );
      }
      if (url.includes("GetCountryFuelTypes")) {
        return Promise.resolve(
          jsonResponse(
            opts.fuelTypes ?? {},
            opts.fuelTypesOk ?? true,
            opts.fuelTypesOk === false ? 500 : 200
          )
        );
      }
      return Promise.reject(new Error(`unexpected URL ${url}`));
    });
  }

  // Adelaide-ish coordinates: comfortably inside the SA bounding box.
  const insideSite = (id: number) => ({
    S: id,
    N: `Inside Site ${id}`,
    A: "1 Test Rd",
    B: 5,
    P: "5000",
    Lat: -34.9,
    Lng: 138.6,
  });
  // Brisbane-ish coordinates: outside the SA bounding box (lng > 141.5).
  const outsideSite = (id: number) => ({
    S: id,
    N: `Outside Site ${id}`,
    A: "1 Test Rd",
    B: 5,
    P: "4000",
    Lat: -27.5,
    Lng: 153.0,
  });

  it("converts tenths-of-a-cent prices to cents/L", async () => {
    const { fetchSAStations } = loadSaModule();
    routeFetch({
      sites: { S: [insideSite(1)] },
      prices: { SitePrices: [{ SiteId: 1, FuelId: 2, Price: 1899, TransactionDateUtc: "2026-07-14T10:00:00Z" }] },
    });

    const stations = await fetchSAStations();
    expect(stations).toHaveLength(1);
    expect(stations[0].prices[0].price).toBeCloseTo(189.9);
    expect(stations[0].prices[0].fuel).toBe("U91"); // static SA_FUEL_MAP (QLD-derived) fallback for FuelId 2
  });

  it("drops the minority of sites outside the SA bounding box without throwing", async () => {
    const { fetchSAStations } = loadSaModule();
    routeFetch({
      sites: { S: [insideSite(1), insideSite(2), insideSite(3), insideSite(4), outsideSite(5)] },
      prices: { SitePrices: [] },
    });

    const stations = await fetchSAStations();
    expect(stations).toHaveLength(4);
    expect(stations.every((s) => !s.id.includes("-5"))).toBe(true);
  });

  it("throws naming the likely misconfiguration when the majority of sites are outside the SA bounding box", async () => {
    const { fetchSAStations } = loadSaModule();
    routeFetch({
      sites: { S: [insideSite(1), outsideSite(2), outsideSite(3), outsideSite(4), outsideSite(5)] },
      prices: { SitePrices: [] },
    });

    await expect(fetchSAStations()).rejects.toThrow(/bounding box/i);
    await expect(fetchSAStations()).rejects.toThrow(/SA_FPIS_COUNTRY_ID|SA_FPIS_GEOREGION_ID/);
  });

  it("falls back to the static SA_FUEL_MAP when GetCountryFuelTypes fails", async () => {
    const { fetchSAStations } = loadSaModule();
    routeFetch({
      sites: { S: [insideSite(1)] },
      prices: { SitePrices: [{ SiteId: 1, FuelId: 3, Price: 1799, TransactionDateUtc: "2026-07-14T10:00:00Z" }] },
      fuelTypesOk: false,
    });

    const stations = await fetchSAStations();
    expect(stations[0].prices[0].fuel).toBe("DL"); // static map: FuelId 3 -> DL (diesel)
  });

  it("prefers the runtime GetCountryFuelTypes mapping over the static fallback when it resolves", async () => {
    const { fetchSAStations } = loadSaModule();
    routeFetch({
      sites: { S: [insideSite(1)] },
      // FuelId 2 is "U91" in the static map; the live reference calls it
      // "Premium Unleaded 98" for this test to prove the live lookup wins.
      prices: { SitePrices: [{ SiteId: 1, FuelId: 2, Price: 2099, TransactionDateUtc: "2026-07-14T10:00:00Z" }] },
      fuelTypes: { FuelTypes: [{ FuelId: 2, Name: "Premium Unleaded 98" }] },
    });

    const stations = await fetchSAStations();
    expect(stations[0].prices[0].fuel).toBe("P98");
  });

  it("resolves brand names via the live GetCountryBrands join", async () => {
    const { fetchSAStations } = loadSaModule();
    routeFetch({
      sites: { S: [insideSite(1)] },
      prices: { SitePrices: [] },
    });

    const stations = await fetchSAStations();
    expect(stations[0].brand).toBe("BP");
  });

  it("plumbs SA_FPIS_COUNTRY_ID / SA_FPIS_GEOREGION_LEVEL / SA_FPIS_GEOREGION_ID overrides into the requested URLs", async () => {
    process.env.SA_FPIS_COUNTRY_ID = "77";
    process.env.SA_FPIS_GEOREGION_LEVEL = "9";
    process.env.SA_FPIS_GEOREGION_ID = "55";

    const { fetchSAStations } = loadSaModule();
    routeFetch({
      sites: { S: [insideSite(1)] },
      prices: { SitePrices: [] },
    });

    await fetchSAStations();

    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    const sitesUrl = urls.find((u) => u.includes("GetFullSiteDetails"))!;
    const pricesUrl = urls.find((u) => u.includes("GetSitesPrices"))!;
    const brandsUrl = urls.find((u) => u.includes("GetCountryBrands"))!;
    const fuelTypesUrl = urls.find((u) => u.includes("GetCountryFuelTypes"))!;

    for (const url of [sitesUrl, pricesUrl, brandsUrl, fuelTypesUrl]) {
      expect(url).toContain("countryId=77");
    }
    expect(sitesUrl).toContain("geoRegionLevel=9");
    expect(sitesUrl).toContain("geoRegionId=55");
    expect(pricesUrl).toContain("geoRegionLevel=9");
    expect(pricesUrl).toContain("geoRegionId=55");
  });
});
