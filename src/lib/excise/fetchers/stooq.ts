/**
 * Fetch Brent crude (USD/bbl) from Stooq's CB.F continuous futures contract.
 * Free, no auth. Returns CSV:
 *   Symbol,Date,Time,Open,High,Low,Close,Volume
 *   CB.F,2026-04-16,08:18:12,94.65,95.29,94.44,94.78,
 *
 * We read the Close column.
 */

const STOOQ_URL = "https://stooq.com/q/l/?s=cb.f&f=sd2t2ohlcv&h&e=csv";

export async function fetchStooqBrent(): Promise<number> {
  let response: Response;
  try {
    response = await fetch(STOOQ_URL);
  } catch (e) {
    throw new Error(`Stooq fetch failed: ${(e as Error).message}`);
  }

  if (!response.ok) {
    throw new Error(`Stooq HTTP ${response.status}`);
  }

  const csv = await response.text();
  return parseStooqBrent(csv);
}

/** Exported for testing. */
export function parseStooqBrent(csv: string): number {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) {
    throw new Error("Stooq: CSV has no data row");
  }

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const closeIdx = header.indexOf("close");
  if (closeIdx === -1) {
    throw new Error(`Stooq: no Close column in header (${lines[0]})`);
  }

  const cols = lines[1].split(",");
  const rawClose = cols[closeIdx]?.trim();
  if (!rawClose || rawClose.toUpperCase() === "N/D") {
    throw new Error(`Stooq: Close empty or N/D (row: ${lines[1]})`);
  }

  const close = Number(rawClose);
  if (!Number.isFinite(close)) {
    throw new Error(`Stooq: Close not a number (got "${rawClose}")`);
  }
  if (close < 1 || close > 500) {
    throw new Error(`Stooq: Close out of range (${close})`);
  }
  return close;
}
