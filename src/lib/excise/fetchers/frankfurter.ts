/**
 * Fetch AUD/USD from Frankfurter (European Central Bank reference rates).
 * Free, no auth, no rate limits worth worrying about.
 *
 * Response shape:
 *   { amount: 1, base: "AUD", date: "2026-04-16", rates: { USD: 0.71364 } }
 */

const FRANKFURTER_URL = "https://api.frankfurter.app/latest?from=AUD&to=USD";

export async function fetchFrankfurterAUD(): Promise<number> {
  let response: Response;
  try {
    response = await fetch(FRANKFURTER_URL);
  } catch (e) {
    throw new Error(`Frankfurter fetch failed: ${(e as Error).message}`);
  }

  if (!response.ok) {
    throw new Error(`Frankfurter HTTP ${response.status}`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (e) {
    throw new Error(`Frankfurter JSON parse failed: ${(e as Error).message}`);
  }

  return parseFrankfurter(payload);
}

/** Exported for testing. */
export function parseFrankfurter(payload: unknown): number {
  if (!payload || typeof payload !== "object") {
    throw new Error("Frankfurter: response not an object");
  }
  const rates = (payload as { rates?: unknown }).rates;
  if (!rates || typeof rates !== "object") {
    throw new Error("Frankfurter: missing rates object");
  }
  const usd = (rates as { USD?: unknown }).USD;
  if (typeof usd !== "number" || !Number.isFinite(usd)) {
    throw new Error(`Frankfurter: USD not a number (got ${typeof usd})`);
  }
  if (usd < 0.1 || usd > 2.0) {
    throw new Error(`Frankfurter: USD out of range (${usd})`);
  }
  return usd;
}
