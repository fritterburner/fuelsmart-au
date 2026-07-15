import {
  MAX_ALERTS_PER_DEVICE,
  isValidPushSubscription,
  isStructurallyValidStoredAlert,
  validateAlertInput,
  requestBodyTooLarge,
} from "../validate";

describe("validateAlertInput", () => {
  it("accepts a valid station-scoped alert", () => {
    const result = validateAlertInput({ scope: "station", stationId: "nt-1", fuel: "U91", targetCpl: 150 });
    expect(result.ok).toBe(true);
  });

  it("accepts a valid state-scoped alert", () => {
    const result = validateAlertInput({ scope: "state", state: "NT", fuel: "DL", targetCpl: 180 });
    expect(result.ok).toBe(true);
  });

  it("rejects an unknown fuel code", () => {
    const result = validateAlertInput({ scope: "state", state: "NT", fuel: "ROCKET_FUEL", targetCpl: 150 });
    expect(result.ok).toBe(false);
  });

  it("rejects targetCpl below the sanity floor", () => {
    const result = validateAlertInput({ scope: "state", state: "NT", fuel: "U91", targetCpl: 10 });
    expect(result.ok).toBe(false);
  });

  it("rejects targetCpl above the sanity ceiling", () => {
    const result = validateAlertInput({ scope: "state", state: "NT", fuel: "U91", targetCpl: 999 });
    expect(result.ok).toBe(false);
  });

  it("rejects a station-scoped alert missing stationId", () => {
    const result = validateAlertInput({ scope: "station", fuel: "U91", targetCpl: 150 });
    expect(result.ok).toBe(false);
  });

  it("rejects a state-scoped alert with an invalid state", () => {
    const result = validateAlertInput({ scope: "state", state: "ZZ", fuel: "U91", targetCpl: 150 });
    expect(result.ok).toBe(false);
  });

  it("rejects an unknown scope", () => {
    const result = validateAlertInput({ scope: "country", fuel: "U91", targetCpl: 150 });
    expect(result.ok).toBe(false);
  });

  it("keeps the per-device cap findable by callers", () => {
    expect(MAX_ALERTS_PER_DEVICE).toBeGreaterThan(0);
    expect(MAX_ALERTS_PER_DEVICE).toBeLessThanOrEqual(20);
  });
});

describe("isStructurallyValidStoredAlert", () => {
  it("accepts a well-formed stored alert", () => {
    expect(
      isStructurallyValidStoredAlert({
        id: "abc",
        scope: "state",
        state: "VIC",
        fuel: "P98",
        targetCpl: 200,
        createdAt: "2026-01-01T00:00:00.000Z",
      })
    ).toBe(true);
  });

  it("rejects an alert missing an id", () => {
    expect(
      isStructurallyValidStoredAlert({
        scope: "state",
        state: "VIC",
        fuel: "P98",
        targetCpl: 200,
        createdAt: "2026-01-01T00:00:00.000Z",
      })
    ).toBe(false);
  });

  it("rejects non-object input", () => {
    expect(isStructurallyValidStoredAlert(null)).toBe(false);
    expect(isStructurallyValidStoredAlert("nope")).toBe(false);
    expect(isStructurallyValidStoredAlert(42)).toBe(false);
  });
});

describe("isValidPushSubscription", () => {
  it("accepts a well-formed subscription", () => {
    expect(
      isValidPushSubscription({
        endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
        keys: { p256dh: "key1", auth: "key2" },
      })
    ).toBe(true);
  });

  it("rejects a non-https endpoint", () => {
    expect(
      isValidPushSubscription({
        endpoint: "http://insecure.example.com/x",
        keys: { p256dh: "key1", auth: "key2" },
      })
    ).toBe(false);
  });

  it("rejects a subscription missing keys", () => {
    expect(isValidPushSubscription({ endpoint: "https://example.com/x" })).toBe(false);
  });
});

describe("requestBodyTooLarge", () => {
  it("allows small bodies", () => {
    expect(requestBodyTooLarge(JSON.stringify({ device: "x" }))).toBe(false);
  });

  it("rejects oversized bodies", () => {
    expect(requestBodyTooLarge("x".repeat(50_000))).toBe(true);
  });
});

// --- SSRF guard on push endpoints (added in integration red-team pass) ---
import { isAcceptablePushEndpoint } from "../validate";

describe("isAcceptablePushEndpoint", () => {
  const good = [
    "https://fcm.googleapis.com/fcm/send/abc123",
    "https://updates.push.services.mozilla.com/wpush/v2/xyz",
    "https://web.push.apple.com/QOtoken",
  ];
  const bad = [
    "http://fcm.googleapis.com/fcm/send/abc", // not https
    "https://127.0.0.1/push",
    "https://10.0.0.5/push",
    "https://localhost/push",
    "https://foo.localhost/push",
    "https://internal-svc/push", // no dot
    "https://svc.internal/push",
    "https://printer.local/push",
    "https://[::1]/push",
    "not a url",
    "https://ok.example.com/" + "a".repeat(1100), // too long
  ];
  it.each(good)("accepts %s", (u) => expect(isAcceptablePushEndpoint(u)).toBe(true));
  it.each(bad)("rejects %s", (u) => expect(isAcceptablePushEndpoint(u)).toBe(false));
});
