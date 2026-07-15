import { decideForDevice, REARM_WINDOW_MS } from "../evaluate";
import { buildPriceIndex } from "../pricing";
import type { Alert, DeviceAlertRecord } from "../types";
import type { Station } from "@/lib/types";

const NOW = new Date("2026-07-15T00:00:00.000Z");

function station(overrides: Partial<Station> & Pick<Station, "id" | "state">): Station {
  return {
    id: overrides.id,
    name: overrides.name ?? `Station ${overrides.id}`,
    brand: "Unbranded",
    brandCode: "UNB",
    address: "1 Test St",
    suburb: "Testville",
    state: overrides.state,
    postcode: "0800",
    lat: -12.4,
    lng: 130.8,
    prices: overrides.prices ?? [],
  };
}

function baseAlert(overrides: Partial<Alert>): Alert {
  return {
    id: "alert-1",
    scope: "station",
    fuel: "U91",
    targetCpl: 150,
    createdAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

function recordWith(alerts: Alert[], subscription: DeviceAlertRecord["subscription"] = null): DeviceAlertRecord {
  return { subscription, alerts, updatedAt: "2026-07-01T00:00:00.000Z" };
}

describe("decideForDevice", () => {
  it("triggers when the station price is at or below target", () => {
    const stations = [
      station({ id: "nt-1", state: "NT", prices: [{ fuel: "U91", price: 149.9, updated: NOW.toISOString() }] }),
    ];
    const index = buildPriceIndex(stations);
    const alert = baseAlert({ scope: "station", stationId: "nt-1", targetCpl: 150 });
    const decision = decideForDevice("dev-1", recordWith([alert]), index, NOW);

    expect(decision.triggered).toHaveLength(1);
    expect(decision.triggered[0].price).toBe(149.9);
    expect(decision.updatedAlerts[0].lastTriggeredAt).toBe(NOW.toISOString());
  });

  it("triggers exactly at the target price (<=, not <)", () => {
    const stations = [
      station({ id: "nt-1", state: "NT", prices: [{ fuel: "U91", price: 150, updated: NOW.toISOString() }] }),
    ];
    const index = buildPriceIndex(stations);
    const alert = baseAlert({ scope: "station", stationId: "nt-1", targetCpl: 150 });
    const decision = decideForDevice("dev-1", recordWith([alert]), index, NOW);
    expect(decision.triggered).toHaveLength(1);
  });

  it("does not trigger when price is above target", () => {
    const stations = [
      station({ id: "nt-1", state: "NT", prices: [{ fuel: "U91", price: 150.1, updated: NOW.toISOString() }] }),
    ];
    const index = buildPriceIndex(stations);
    const alert = baseAlert({ scope: "station", stationId: "nt-1", targetCpl: 150 });
    const decision = decideForDevice("dev-1", recordWith([alert]), index, NOW);
    expect(decision.triggered).toHaveLength(0);
    expect(decision.updatedAlerts[0].lastTriggeredAt).toBeUndefined();
  });

  it("respects the 24h re-arm window — does not re-fire within 24h of lastTriggeredAt", () => {
    const stations = [
      station({ id: "nt-1", state: "NT", prices: [{ fuel: "U91", price: 140, updated: NOW.toISOString() }] }),
    ];
    const index = buildPriceIndex(stations);
    const justUnder24h = new Date(NOW.getTime() - (REARM_WINDOW_MS - 60_000)).toISOString();
    const alert = baseAlert({ scope: "station", stationId: "nt-1", targetCpl: 150, lastTriggeredAt: justUnder24h });
    const decision = decideForDevice("dev-1", recordWith([alert]), index, NOW);

    expect(decision.triggered).toHaveLength(0);
    // lastTriggeredAt is left untouched, not bumped, while suppressed.
    expect(decision.updatedAlerts[0].lastTriggeredAt).toBe(justUnder24h);
  });

  it("fires again once the 24h re-arm window has fully elapsed", () => {
    const stations = [
      station({ id: "nt-1", state: "NT", prices: [{ fuel: "U91", price: 140, updated: NOW.toISOString() }] }),
    ];
    const index = buildPriceIndex(stations);
    const justOver24h = new Date(NOW.getTime() - (REARM_WINDOW_MS + 60_000)).toISOString();
    const alert = baseAlert({ scope: "station", stationId: "nt-1", targetCpl: 150, lastTriggeredAt: justOver24h });
    const decision = decideForDevice("dev-1", recordWith([alert]), index, NOW);

    expect(decision.triggered).toHaveLength(1);
    expect(decision.updatedAlerts[0].lastTriggeredAt).toBe(NOW.toISOString());
  });

  it("state-scoped alerts use the minimum price across stations in that state", () => {
    const stations = [
      station({ id: "qld-1", state: "QLD", prices: [{ fuel: "U91", price: 179.9, updated: NOW.toISOString() }] }),
      station({ id: "qld-2", state: "QLD", prices: [{ fuel: "U91", price: 155.5, updated: NOW.toISOString() }] }),
      station({ id: "qld-3", state: "QLD", prices: [{ fuel: "U91", price: 168.0, updated: NOW.toISOString() }] }),
      // Different state — must not leak into QLD's minimum.
      station({ id: "nt-1", state: "NT", prices: [{ fuel: "U91", price: 100.0, updated: NOW.toISOString() }] }),
    ];
    const index = buildPriceIndex(stations);
    const alert = baseAlert({ scope: "state", state: "QLD", stationId: undefined, targetCpl: 160 });
    const decision = decideForDevice("dev-1", recordWith([alert]), index, NOW);

    expect(decision.triggered).toHaveLength(1);
    expect(decision.triggered[0].price).toBe(155.5); // QLD min, not NT's 100 and not QLD's other stations
  });

  it("skips (does not trigger, does not throw) when the station is unknown", () => {
    const stations = [
      station({ id: "nt-1", state: "NT", prices: [{ fuel: "U91", price: 100, updated: NOW.toISOString() }] }),
    ];
    const index = buildPriceIndex(stations);
    const alert = baseAlert({ scope: "station", stationId: "does-not-exist", targetCpl: 150 });
    const decision = decideForDevice("dev-1", recordWith([alert]), index, NOW);

    expect(decision.triggered).toHaveLength(0);
    // Unknown-station alerts are preserved as-is (not dropped) so the user's alert survives a transient gap.
    expect(decision.updatedAlerts).toHaveLength(1);
  });

  it("skips a station that no longer stocks the alerted fuel", () => {
    const stations = [
      station({ id: "nt-1", state: "NT", prices: [{ fuel: "DL", price: 100, updated: NOW.toISOString() }] }),
    ];
    const index = buildPriceIndex(stations);
    const alert = baseAlert({ scope: "station", stationId: "nt-1", fuel: "U91", targetCpl: 150 });
    const decision = decideForDevice("dev-1", recordWith([alert]), index, NOW);
    expect(decision.triggered).toHaveLength(0);
  });

  it("drops malformed alerts entirely instead of throwing", () => {
    const stations = [
      station({ id: "nt-1", state: "NT", prices: [{ fuel: "U91", price: 100, updated: NOW.toISOString() }] }),
    ];
    const index = buildPriceIndex(stations);
    const malformed = [
      { id: "bad-1" }, // missing everything
      { id: "bad-2", scope: "station", fuel: "U91", targetCpl: 1000 }, // target out of range
      { id: "bad-3", scope: "state", fuel: "NOT_A_FUEL", targetCpl: 150, state: "NT" }, // bad fuel code
      { id: "bad-4", scope: "banana", fuel: "U91", targetCpl: 150 }, // bad scope
      null,
      "not even an object",
    ] as unknown as Alert[];
    const record = recordWith(malformed);

    const decision = decideForDevice("dev-1", record, index, NOW);

    expect(decision.triggered).toHaveLength(0);
    expect(decision.updatedAlerts).toHaveLength(0);
  });

  it("evaluates a mix of valid and malformed alerts independently", () => {
    const stations = [
      station({ id: "nt-1", state: "NT", prices: [{ fuel: "U91", price: 120, updated: NOW.toISOString() }] }),
    ];
    const index = buildPriceIndex(stations);
    const good = baseAlert({ id: "good-1", scope: "station", stationId: "nt-1", targetCpl: 150 });
    const bad = { id: "bad-1", scope: "nonsense" } as unknown as Alert;
    const decision = decideForDevice("dev-1", recordWith([good, bad]), index, NOW);

    expect(decision.triggered).toHaveLength(1);
    expect(decision.triggered[0].alert.id).toBe("good-1");
    expect(decision.updatedAlerts).toHaveLength(1);
  });
});
