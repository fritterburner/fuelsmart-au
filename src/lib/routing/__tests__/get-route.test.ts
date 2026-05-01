/**
 * Smoke tests for the routing facade. We intercept global `fetch` rather than
 * standing up a fixture server — the contract under test is "what URLs we hit
 * and how we react to each provider's response shape", not anything network-y.
 */

import { getRoute, RouteThrottledError } from "../get-route";

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_KEY = process.env.OPENROUTESERVICE_API_KEY;

interface MockResponse {
  status: number;
  body?: unknown;
  bodyText?: string;
}

function mockFetch(impl: (url: string, init?: RequestInit) => MockResponse) {
  globalThis.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const r = impl(url, init);
    const status = r.status;
    const body = r.bodyText ?? (r.body !== undefined ? JSON.stringify(r.body) : "");
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => (r.body !== undefined ? r.body : JSON.parse(body || "null")),
      text: async () => body,
    } as Response;
  }) as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  if (ORIGINAL_KEY === undefined) delete process.env.OPENROUTESERVICE_API_KEY;
  else process.env.OPENROUTESERVICE_API_KEY = ORIGINAL_KEY;
  jest.clearAllMocks();
});

const COORDS: [number, number][] = [
  [-25.54, 152.71], // Maryborough
  [-27.47, 153.02], // Brisbane
];

const OSRM_OK = {
  code: "Ok",
  routes: [
    {
      distance: 250_000,
      duration: 9_000,
      geometry: { coordinates: [[152.71, -25.54], [153.02, -27.47]] },
    },
  ],
};

const ORS_OK = {
  features: [
    {
      geometry: { coordinates: [[152.71, -25.54], [153.02, -27.47]] },
      properties: { summary: { distance: 250_000, duration: 9_000 } },
    },
  ],
};

describe("getRoute", () => {
  it("returns OSRM result on the happy path", async () => {
    mockFetch(() => ({ status: 200, body: OSRM_OK }));
    const r = await getRoute(COORDS);
    expect(r.provider).toBe("osrm");
    expect(r.distanceMeters).toBe(250_000);
    expect(r.durationSeconds).toBe(9_000);
    expect(r.geometryLatLng).toEqual([
      [-25.54, 152.71],
      [-27.47, 153.02],
    ]);
  });

  it("falls back to ORS when OSRM is throttled and a key is configured", async () => {
    process.env.OPENROUTESERVICE_API_KEY = "test-key";
    mockFetch((url) => {
      if (url.includes("router.project-osrm.org")) return { status: 429 };
      if (url.includes("openrouteservice.org")) return { status: 200, body: ORS_OK };
      throw new Error(`unexpected url: ${url}`);
    });
    const r = await getRoute(COORDS);
    expect(r.provider).toBe("ors");
    expect(r.distanceMeters).toBe(250_000);
  });

  it("falls back to ORS on OSRM 5xx-after-retry", async () => {
    process.env.OPENROUTESERVICE_API_KEY = "test-key";
    mockFetch((url) => {
      if (url.includes("router.project-osrm.org")) return { status: 502 };
      if (url.includes("openrouteservice.org")) return { status: 200, body: ORS_OK };
      throw new Error(`unexpected url: ${url}`);
    });
    const r = await getRoute(COORDS);
    expect(r.provider).toBe("ors");
  });

  it("throws RouteThrottledError when OSRM throttles and ORS is unconfigured", async () => {
    delete process.env.OPENROUTESERVICE_API_KEY;
    mockFetch(() => ({ status: 429 }));
    await expect(getRoute(COORDS)).rejects.toBeInstanceOf(RouteThrottledError);
  });

  it("throws RouteThrottledError when both providers are throttled", async () => {
    process.env.OPENROUTESERVICE_API_KEY = "test-key";
    mockFetch((url) => {
      if (url.includes("router.project-osrm.org")) return { status: 429 };
      if (url.includes("openrouteservice.org")) return { status: 429 };
      throw new Error(`unexpected url: ${url}`);
    });
    await expect(getRoute(COORDS)).rejects.toBeInstanceOf(RouteThrottledError);
  });

  it("propagates 'no route' as a hard error, not a throttle", async () => {
    delete process.env.OPENROUTESERVICE_API_KEY;
    mockFetch(() => ({ status: 200, body: { code: "NoRoute", routes: [] } }));
    await expect(getRoute(COORDS)).rejects.toThrow(/OSRM no route/);
  });

  it("sends ORS the api key in the Authorization header and lng,lat coords", async () => {
    process.env.OPENROUTESERVICE_API_KEY = "secret-key-123";
    let capturedInit: RequestInit | undefined;
    mockFetch((url, init) => {
      if (url.includes("router.project-osrm.org")) return { status: 503 };
      if (url.includes("openrouteservice.org")) {
        capturedInit = init;
        return { status: 200, body: ORS_OK };
      }
      throw new Error(`unexpected url: ${url}`);
    });
    await getRoute(COORDS);
    const headers = capturedInit?.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("secret-key-123");
    const body = JSON.parse((capturedInit?.body as string) ?? "{}");
    expect(body.coordinates).toEqual([
      [152.71, -25.54],
      [153.02, -27.47],
    ]);
  });
});
