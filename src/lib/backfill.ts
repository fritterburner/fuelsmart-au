import { FuelCode } from "./types";

/**
 * Pure parsing/aggregation for the one-off historical backfill. Kept separate
 * from the API route so it's unit-testable without network or Redis.
 *
 * Handles the open-data "price history" CSVs:
 *  - NSW/ACT (Data.NSW): string fuel codes (U91, E10, P95, …), price in cents.
 *  - QLD (data.qld): fuel-type names, price usually in cents (sometimes tenths).
 * Column positions are detected by fuzzy header matching, so small differences
 * in header wording between months/states don't break it.
 */

const FUEL_ALIASES: Record<string, FuelCode> = {
  U91: "U91", UNLEADED: "U91", UNLEADED91: "U91", ULP: "U91", E91: "U91", PULP91: "U91",
  E10: "E10", ETHANOL94: "E10", ETHANOL94E10: "E10",
  P95: "P95", PULP95: "P95", PREMIUM95: "P95", PREMIUMUNLEADED95: "P95", "95": "P95",
  P98: "P98", PULP98: "P98", PREMIUM98: "P98", PREMIUMUNLEADED98: "P98", "98": "P98",
  DL: "DL", DIESEL: "DL",
  PD: "PD", PDL: "PD", PREMIUMDIESEL: "PD",
  LPG: "LPG", LPGAS: "LPG",
  E85: "E85",
};

/** Map a raw fuel cell (code or name) to our canonical FuelCode, or null. */
export function normaliseFuel(raw: string): FuelCode | null {
  const key = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return FUEL_ALIASES[key] ?? null;
}

/** Quote-aware CSV line split (handles commas inside double-quoted fields). */
export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export interface ColumnMap {
  fuel: number;
  price: number;
  date: number;
}

function norm(h: string): string {
  return h.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Locate the fuel / price / date columns by fuzzy header match. */
export function detectColumns(header: string[]): ColumnMap | { error: string } {
  const normed = header.map(norm);
  const find = (pred: (h: string) => boolean) => normed.findIndex(pred);

  const fuel = find((h) => h.includes("FUEL"));
  let price = find((h) => h === "PRICE");
  if (price < 0) price = find((h) => h.includes("PRICE") && !h.includes("DATE"));
  // Prefer a "transaction"/"updated" date column over any other date-ish column.
  let date = find((h) => h.includes("DATE") && (h.includes("TRANSACTION") || h.includes("UPDATED")));
  if (date < 0) date = find((h) => h.includes("DATE"));

  if (fuel < 0 || price < 0 || date < 0) {
    return {
      error: `Could not detect columns (fuel=${fuel}, price=${price}, date=${date}). Headers seen: ${header.join(" | ")}`,
    };
  }
  return { fuel, price, date };
}

/** Normalise a price cell to cents/L; rejects sentinels and out-of-range values. */
export function normalisePrice(raw: string): number | null {
  let v = Number(String(raw).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(v) || v <= 0) return null;
  if (v > 400) v = v / 10; // some feeds report tenths of a cent (e.g. 1899 -> 189.9)
  if (v < 40 || v > 400) return null; // reject 999.9 sentinels / junk
  return v;
}

/** Extract a YYYY-MM-DD day key from a date cell (handles ISO and DD/MM/YYYY). */
export function toDayKey(raw: string): string | null {
  const s = String(raw).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmy) {
    const d = dmy[1].padStart(2, "0");
    const m = dmy[2].padStart(2, "0");
    return `${dmy[3]}-${m}-${d}`;
  }
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

export interface DayAgg {
  sum: number;
  min: number;
  count: number;
}
export type Aggregate = Map<string, Map<FuelCode, DayAgg>>;

export function createAggregate(): Aggregate {
  return new Map();
}

/** Fold one parsed row into the running aggregate (streaming-friendly). */
export function foldRow(agg: Aggregate, row: string[], cols: ColumnMap): boolean {
  const fuel = normaliseFuel(row[cols.fuel] ?? "");
  if (!fuel) return false;
  const price = normalisePrice(row[cols.price] ?? "");
  if (price == null) return false;
  const day = toDayKey(row[cols.date] ?? "");
  if (!day) return false;

  let byFuel = agg.get(day);
  if (!byFuel) {
    byFuel = new Map();
    agg.set(day, byFuel);
  }
  const a = byFuel.get(fuel);
  if (a) {
    a.sum += price;
    a.count += 1;
    if (price < a.min) a.min = price;
  } else {
    byFuel.set(fuel, { sum: price, min: price, count: 1 });
  }
  return true;
}

/** Convenience for tests: fold an array of rows. */
export function aggregateRows(rows: string[][], cols: ColumnMap): Aggregate {
  const agg = createAggregate();
  for (const r of rows) foldRow(agg, r, cols);
  return agg;
}

/** Turn one day's per-fuel aggregate into the stored {avg,min,count} shape. */
export function finaliseDay(
  byFuel: Map<FuelCode, DayAgg>,
): Partial<Record<FuelCode, { avg: number; min: number; count: number }>> {
  const out: Partial<Record<FuelCode, { avg: number; min: number; count: number }>> = {};
  for (const [fuel, a] of byFuel) {
    out[fuel] = { avg: Math.round((a.sum / a.count) * 10) / 10, min: a.min, count: a.count };
  }
  return out;
}
