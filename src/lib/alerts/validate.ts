import type { FuelCode, StateCode } from "@/lib/types";
import { FUEL_TYPES } from "@/lib/fuel-codes";
import type { Alert, AlertInput, PushSubscriptionJSON } from "./types";

// --- Limits (deliberately conservative — this is an unauthenticated,
// capability-token API, so every input is treated as hostile until proven
// otherwise) ---
export const MAX_ALERTS_PER_DEVICE = 10;
export const MIN_TARGET_CPL = 50;
export const MAX_TARGET_CPL = 400;
export const MAX_DEVICE_ID_LEN = 100;
export const MAX_STATION_ID_LEN = 80;
/** Whole-request body cap for POST /api/alerts. */
export const MAX_REQUEST_BODY_BYTES = 20_000;

const VALID_FUEL_CODES = new Set<string>(FUEL_TYPES.map((f) => f.code));
const VALID_STATE_CODES = new Set<string>([
  "NT",
  "QLD",
  "WA",
  "NSW",
  "ACT",
  "SA",
  "VIC",
  "TAS",
]);

export function isValidDeviceId(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= MAX_DEVICE_ID_LEN;
}

export function isValidFuelCode(v: unknown): v is FuelCode {
  return typeof v === "string" && VALID_FUEL_CODES.has(v);
}

export function isValidStateCode(v: unknown): v is StateCode {
  return typeof v === "string" && VALID_STATE_CODES.has(v);
}

export function isValidTargetCpl(v: unknown): v is number {
  return (
    typeof v === "number" &&
    Number.isFinite(v) &&
    v >= MIN_TARGET_CPL &&
    v <= MAX_TARGET_CPL
  );
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

/** Validates a single alert as submitted by a client (no id/timestamps yet). */
export function validateAlertInput(raw: unknown): ValidationResult<AlertInput> {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "alert must be an object" };
  }
  const a = raw as Record<string, unknown>;

  if (a.scope !== "station" && a.scope !== "state") {
    return { ok: false, error: "scope must be 'station' or 'state'" };
  }
  if (!isValidFuelCode(a.fuel)) {
    return { ok: false, error: "invalid fuel code" };
  }
  if (!isValidTargetCpl(a.targetCpl)) {
    return {
      ok: false,
      error: `targetCpl must be a number between ${MIN_TARGET_CPL} and ${MAX_TARGET_CPL}`,
    };
  }

  if (a.scope === "station") {
    if (
      typeof a.stationId !== "string" ||
      a.stationId.length === 0 ||
      a.stationId.length > MAX_STATION_ID_LEN
    ) {
      return { ok: false, error: "stationId is required for a station-scoped alert" };
    }
    return {
      ok: true,
      value: {
        scope: "station",
        stationId: a.stationId,
        fuel: a.fuel as FuelCode,
        targetCpl: a.targetCpl as number,
      },
    };
  }

  if (!isValidStateCode(a.state)) {
    return { ok: false, error: "invalid or missing state for a state-scoped alert" };
  }
  return {
    ok: true,
    value: {
      scope: "state",
      state: a.state as StateCode,
      fuel: a.fuel as FuelCode,
      targetCpl: a.targetCpl as number,
    },
  };
}

/**
 * Structural re-validation of an alert already sitting in Redis. Used by the
 * evaluator so a record that was written by an older/buggy client version (or
 * tampered with, given the API takes only a bearer id) can never crash the
 * cron job — malformed entries are simply skipped.
 */
export function isStructurallyValidStoredAlert(raw: unknown): raw is Alert {
  if (!raw || typeof raw !== "object") return false;
  const a = raw as Record<string, unknown>;
  if (typeof a.id !== "string" || a.id.length === 0) return false;
  if (typeof a.createdAt !== "string") return false;
  if (a.lastTriggeredAt !== undefined && typeof a.lastTriggeredAt !== "string") {
    return false;
  }
  return validateAlertInput(a).ok;
}

/** Max plausible length of a real push-service endpoint URL. */
export const MAX_ENDPOINT_LEN = 1000;

/**
 * SSRF guard: the endpoint is attacker-supplied and our server POSTs to it on
 * every triggered alert. Require https on a public-looking hostname — reject
 * IP literals, localhost, and internal-suffix hosts. We deliberately do NOT
 * allowlist specific push providers (Apple/Google/Mozilla/WNS) so lesser-known
 * UAs keep working; blocking non-public hosts covers the actual risk.
 */
export function isAcceptablePushEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== "string" || endpoint.length > MAX_ENDPOINT_LEN) return false;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) return false;
  if (host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".lan")) return false;
  // IPv4 literal or [IPv6] literal
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
  if (host.includes(":")) return false; // URL hostname strips brackets from IPv6
  // Must have at least one dot (rejects bare intranet hostnames)
  if (!host.includes(".")) return false;
  return true;
}

export function isValidPushSubscription(raw: unknown): raw is PushSubscriptionJSON {
  if (!raw || typeof raw !== "object") return false;
  const s = raw as Record<string, unknown>;
  if (!isAcceptablePushEndpoint(s.endpoint)) return false;
  if (!s.keys || typeof s.keys !== "object") return false;
  const k = s.keys as Record<string, unknown>;
  return typeof k.p256dh === "string" && k.p256dh.length > 0 && typeof k.auth === "string" && k.auth.length > 0;
}

export function requestBodyTooLarge(rawText: string): boolean {
  return Buffer.byteLength(rawText, "utf8") > MAX_REQUEST_BODY_BYTES;
}
