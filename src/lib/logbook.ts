// Pure-logic module for the device-local fuel logbook.
//
// Everything in this file is plain data-in/data-out logic with no DOM or
// storage access, so it can be unit tested under Jest's "node" environment.
// The IndexedDB wrapper at the bottom is the one exception: its functions
// touch `window`/`indexedDB` but only inside function bodies that are never
// invoked from tests, guarded by `typeof window === "undefined"` checks.

import { FuelCode } from "./types";
import { FUEL_TYPES } from "./fuel-codes";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single fill-up, as stored. Cost/price fields are always both present —
 * whichever one the user didn't type in was derived from the other. */
export interface LogbookEntry {
  id: string;
  /** yyyy-mm-dd */
  date: string;
  /** Odometer reading in km at this fill. null = not recorded. */
  odometerKm: number | null;
  /** Litres added. */
  litres: number;
  /** Total amount paid, in dollars. */
  totalCost: number;
  /** Price paid, in cents per litre, to 1 decimal (matches the rest of the app). */
  pricePerLitre: number;
  fuel: FuelCode;
  /** Free text, may be empty. */
  station: string;
  /** Free text, may be empty. */
  notes: string;
}

/** What the add/edit form collects. Provide totalCost OR pricePerLitre (or
 * both) — normalizeEntryDraft derives whichever is missing. */
export interface LogbookEntryDraft {
  id?: string;
  date: string;
  odometerKm?: number | null;
  litres: number;
  totalCost?: number;
  pricePerLitre?: number;
  fuel: FuelCode;
  station?: string;
  notes?: string;
}

export interface NormalizeSuccess {
  ok: true;
  entry: LogbookEntry;
  errors: [];
}

export interface NormalizeFailure {
  ok: false;
  entry?: undefined;
  errors: string[];
}

export type NormalizeResult = NormalizeSuccess | NormalizeFailure;

// ---------------------------------------------------------------------------
// Small numeric / date helpers
// ---------------------------------------------------------------------------

/** Round to 1 decimal place — how cents-per-litre is displayed app-wide. */
export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Round to 2 decimal places — dollars. */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Strict yyyy-mm-dd check that also rejects impossible calendar dates
 * (e.g. 2026-02-30) rather than letting them silently roll over. */
export function isValidDateString(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function isFuelCode(value: unknown): value is FuelCode {
  return typeof value === "string" && FUEL_TYPES.some((f) => f.code === value);
}

/** Dependency-free id generator (no crypto.randomUUID assumption, works in
 * any JS environment including older WebViews). */
export function genId(): string {
  return `lb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------------------
// Entry validation + cost/price derivation
// ---------------------------------------------------------------------------

/**
 * Validates a draft entry and derives whichever of totalCost/pricePerLitre
 * the user didn't type in.
 *
 * Rules:
 * - date must be a real yyyy-mm-dd calendar date.
 * - litres must be a finite number > 0.
 * - fuel must be a known fuel code.
 * - odometerKm, if given, must be a finite number >= 0 (otherwise null).
 * - at least one of totalCost / pricePerLitre must be given as a finite
 *   number > 0; whichever is missing is derived from the other:
 *     pricePerLitre = totalCost / litres * 100   (derived from cost)
 *     totalCost = pricePerLitre * litres / 100   (derived from price)
 *   If both are given, both are kept (rounded) rather than re-derived, so a
 *   user's exact receipt figures aren't silently overwritten by rounding.
 */
export function normalizeEntryDraft(draft: LogbookEntryDraft): NormalizeResult {
  const errors: string[] = [];

  if (!isValidDateString(draft.date)) {
    errors.push("Enter a valid date (YYYY-MM-DD).");
  }

  const litresOk = typeof draft.litres === "number" && Number.isFinite(draft.litres) && draft.litres > 0;
  if (!litresOk) {
    errors.push("Litres must be a number greater than 0.");
  }

  if (!isFuelCode(draft.fuel)) {
    errors.push("Select a valid fuel type.");
  }

  let odometerKm: number | null = null;
  if (draft.odometerKm !== undefined && draft.odometerKm !== null) {
    if (typeof draft.odometerKm !== "number" || !Number.isFinite(draft.odometerKm) || draft.odometerKm < 0) {
      errors.push("Odometer must be a non-negative number, or left blank.");
    } else {
      odometerKm = draft.odometerKm;
    }
  }

  const hasCost = draft.totalCost !== undefined && draft.totalCost !== null;
  const hasPpl = draft.pricePerLitre !== undefined && draft.pricePerLitre !== null;

  if (!hasCost && !hasPpl) {
    errors.push("Enter either a total cost or a price per litre.");
  }
  if (hasCost && (typeof draft.totalCost !== "number" || !Number.isFinite(draft.totalCost) || draft.totalCost <= 0)) {
    errors.push("Total cost must be a number greater than 0.");
  }
  if (hasPpl && (typeof draft.pricePerLitre !== "number" || !Number.isFinite(draft.pricePerLitre) || draft.pricePerLitre <= 0)) {
    errors.push("Price per litre must be a number greater than 0.");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  let totalCost: number;
  let pricePerLitre: number;

  if (hasCost && hasPpl) {
    totalCost = round2(draft.totalCost as number);
    pricePerLitre = round1(draft.pricePerLitre as number);
  } else if (hasCost) {
    totalCost = round2(draft.totalCost as number);
    pricePerLitre = round1((totalCost / draft.litres) * 100);
  } else {
    pricePerLitre = round1(draft.pricePerLitre as number);
    totalCost = round2((pricePerLitre * draft.litres) / 100);
  }

  const entry: LogbookEntry = {
    id: draft.id ?? genId(),
    date: draft.date,
    odometerKm,
    litres: round2(draft.litres),
    totalCost,
    pricePerLitre,
    fuel: draft.fuel,
    station: (draft.station ?? "").trim(),
    notes: (draft.notes ?? "").trim(),
  };

  return { ok: true, entry, errors: [] };
}

// ---------------------------------------------------------------------------
// Derived stats: consumption between odometer readings
// ---------------------------------------------------------------------------

export interface ConsumptionGap {
  fromId: string;
  toId: string;
  fromDate: string;
  toDate: string;
  kmDriven: number;
  /** Litres attributed to this gap (the litres of the arrival fill, assuming
   * a fill-to-full pattern — the standard odometer-based consumption method
   * used by most fuel logbooks). */
  litres: number;
  cost: number;
  lPer100Km: number;
  costPer100Km: number;
}

/**
 * Computes L/100km and $/100km between consecutive odometer readings.
 *
 * - Entries are sorted by date (then odometer, then id) before pairing, so
 *   out-of-order input is handled correctly.
 * - Entries with no odometer reading are excluded from the odometer chain
 *   entirely — they still count in monthly/summary totals, but they can't
 *   anchor or be measured as part of a distance gap.
 * - A pair is only used if the odometer strictly increases (kmDriven > 0);
 *   equal or decreasing odometer readings (duplicate/bad data, or entries
 *   that land on the same day) are skipped rather than producing a
 *   negative/zero/NaN result.
 */
export function computeConsumptionGaps(entries: LogbookEntry[]): ConsumptionGap[] {
  const withOdo = entries
    .filter((e): e is LogbookEntry & { odometerKm: number } => typeof e.odometerKm === "number" && Number.isFinite(e.odometerKm))
    .slice()
    .sort((a, b) => {
      const byDate = a.date.localeCompare(b.date);
      if (byDate !== 0) return byDate;
      const byOdo = a.odometerKm - b.odometerKm;
      if (byOdo !== 0) return byOdo;
      return a.id.localeCompare(b.id);
    });

  const gaps: ConsumptionGap[] = [];

  for (let i = 1; i < withOdo.length; i++) {
    const from = withOdo[i - 1];
    const to = withOdo[i];
    const kmDriven = to.odometerKm - from.odometerKm;
    if (!Number.isFinite(kmDriven) || kmDriven <= 0) continue;
    const litres = to.litres;
    const cost = to.totalCost;
    if (!Number.isFinite(litres) || litres <= 0) continue;

    gaps.push({
      fromId: from.id,
      toId: to.id,
      fromDate: from.date,
      toDate: to.date,
      kmDriven: round1(kmDriven),
      litres,
      cost,
      lPer100Km: round1((litres / kmDriven) * 100),
      costPer100Km: round2((cost / kmDriven) * 100),
    });
  }

  return gaps;
}

// ---------------------------------------------------------------------------
// Derived stats: monthly totals
// ---------------------------------------------------------------------------

export interface MonthlyTotal {
  /** yyyy-mm */
  month: string;
  totalCost: number;
  totalLitres: number;
  fillCount: number;
  /** Spend-weighted average price per litre for the month (cents/L). */
  avgPricePerLitre: number;
}

/** Groups entries by calendar month (yyyy-mm, taken directly from the date
 * string so this is correct across year boundaries — "2025-12" sorts before
 * "2026-01" lexically, same as numerically). Result is sorted oldest first. */
export function computeMonthlyTotals(entries: LogbookEntry[]): MonthlyTotal[] {
  const buckets = new Map<string, { cost: number; litres: number; count: number }>();

  for (const e of entries) {
    const month = e.date.slice(0, 7);
    const bucket = buckets.get(month) ?? { cost: 0, litres: 0, count: 0 };
    bucket.cost += e.totalCost;
    bucket.litres += e.litres;
    bucket.count += 1;
    buckets.set(month, bucket);
  }

  return Array.from(buckets.entries())
    .map(([month, b]) => ({
      month,
      totalCost: round2(b.cost),
      totalLitres: round2(b.litres),
      fillCount: b.count,
      avgPricePerLitre: b.litres > 0 ? round1((b.cost / b.litres) * 100) : 0,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

// ---------------------------------------------------------------------------
// Derived stats: overall summary / running averages
// ---------------------------------------------------------------------------

export interface LogbookSummary {
  fillCount: number;
  totalLitres: number;
  totalCost: number;
  /** Spend-weighted average price paid, cents/L. 0 if no entries. */
  avgPricePerLitre: number;
  /** Weighted average across all valid consumption gaps. null if there are
   * fewer than two odometer readings to form a gap (never NaN). */
  avgLPer100Km: number | null;
  avgCostPer100Km: number | null;
  totalKmTracked: number;
}

export function computeSummary(entries: LogbookEntry[]): LogbookSummary {
  const totalLitres = entries.reduce((s, e) => s + e.litres, 0);
  const totalCost = entries.reduce((s, e) => s + e.totalCost, 0);

  const gaps = computeConsumptionGaps(entries);
  const totalKm = gaps.reduce((s, g) => s + g.kmDriven, 0);
  const gapLitres = gaps.reduce((s, g) => s + g.litres, 0);
  const gapCost = gaps.reduce((s, g) => s + g.cost, 0);

  return {
    fillCount: entries.length,
    totalLitres: round2(totalLitres),
    totalCost: round2(totalCost),
    avgPricePerLitre: totalLitres > 0 ? round1((totalCost / totalLitres) * 100) : 0,
    avgLPer100Km: totalKm > 0 ? round1((gapLitres / totalKm) * 100) : null,
    avgCostPer100Km: totalKm > 0 ? round2((gapCost / totalKm) * 100) : null,
    totalKmTracked: round1(totalKm),
  };
}

/** Sorts entries newest-first for the list UI (by date, then id as a
 * stable tiebreak so same-day entries don't jitter on every render). */
export function sortEntriesNewestFirst(entries: LogbookEntry[]): LogbookEntry[] {
  return entries.slice().sort((a, b) => {
    const byDate = b.date.localeCompare(a.date);
    if (byDate !== 0) return byDate;
    return b.id.localeCompare(a.id);
  });
}

// ---------------------------------------------------------------------------
// Export / import (JSON backup — the privacy-friendly "sync")
// ---------------------------------------------------------------------------

export interface LogbookExportFile {
  version: 1;
  exportedAt: string;
  entries: LogbookEntry[];
}

export function buildExportFile(entries: LogbookEntry[]): LogbookExportFile {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    entries,
  };
}

export type ImportValidationResult =
  | { ok: true; entries: LogbookEntry[] }
  | { ok: false; error: string };

function validateStoredEntry(raw: unknown, index: number): { ok: true; entry: LogbookEntry } | { ok: false; error: string } {
  const label = `Entry ${index + 1}`;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, error: `${label}: not a valid object.` };
  }
  const r = raw as Record<string, unknown>;

  if (typeof r.id !== "string" || r.id.length === 0) {
    return { ok: false, error: `${label}: missing or invalid id.` };
  }
  if (!isValidDateString(r.date)) {
    return { ok: false, error: `${label}: missing or invalid date.` };
  }
  if (typeof r.litres !== "number" || !Number.isFinite(r.litres) || r.litres <= 0) {
    return { ok: false, error: `${label}: litres must be a positive number.` };
  }
  if (typeof r.totalCost !== "number" || !Number.isFinite(r.totalCost) || r.totalCost < 0) {
    return { ok: false, error: `${label}: totalCost must be a non-negative number.` };
  }
  if (typeof r.pricePerLitre !== "number" || !Number.isFinite(r.pricePerLitre) || r.pricePerLitre < 0) {
    return { ok: false, error: `${label}: pricePerLitre must be a non-negative number.` };
  }
  if (!isFuelCode(r.fuel)) {
    return { ok: false, error: `${label}: unknown fuel type.` };
  }
  if (r.odometerKm !== null && r.odometerKm !== undefined) {
    if (typeof r.odometerKm !== "number" || !Number.isFinite(r.odometerKm) || r.odometerKm < 0) {
      return { ok: false, error: `${label}: odometerKm must be null or a non-negative number.` };
    }
  }

  const entry: LogbookEntry = {
    id: r.id,
    date: r.date,
    odometerKm: typeof r.odometerKm === "number" ? r.odometerKm : null,
    litres: r.litres,
    totalCost: r.totalCost,
    pricePerLitre: r.pricePerLitre,
    fuel: r.fuel,
    station: typeof r.station === "string" ? r.station : "",
    notes: typeof r.notes === "string" ? r.notes : "",
  };
  return { ok: true, entry };
}

/** Validates an imported backup file. Accepts either the wrapped
 * `{ version, exportedAt, entries }` shape produced by buildExportFile, or a
 * bare array of entries for leniency. Rejects anything else — wrong types,
 * missing fields, unknown fuel codes, duplicate ids — with a human-readable
 * reason so the UI can show the user exactly what's wrong. */
export function parseImportedLogbook(raw: unknown): ImportValidationResult {
  let rawEntries: unknown;

  if (Array.isArray(raw)) {
    rawEntries = raw;
  } else if (typeof raw === "object" && raw !== null) {
    rawEntries = (raw as Record<string, unknown>).entries;
  } else {
    return { ok: false, error: "File is not valid JSON (expected an object or array)." };
  }

  if (!Array.isArray(rawEntries)) {
    return { ok: false, error: 'File is missing an "entries" array.' };
  }

  const entries: LogbookEntry[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < rawEntries.length; i++) {
    const result = validateStoredEntry(rawEntries[i], i);
    if (!result.ok) return result;
    if (seenIds.has(result.entry.id)) {
      return { ok: false, error: `Entry ${i + 1}: duplicate id "${result.entry.id}".` };
    }
    seenIds.add(result.entry.id);
    entries.push(result.entry);
  }

  return { ok: true, entries };
}

// ---------------------------------------------------------------------------
// IndexedDB storage (browser only)
// ---------------------------------------------------------------------------
//
// Hand-rolled, dependency-free wrapper around a single object store. Every
// function here is a no-op/empty-result on the server or in a non-browser
// test environment, so importing this module is always safe.

const DB_NAME = "fuelsmart-logbook";
const DB_VERSION = 1;
const STORE_NAME = "entries";

function hasIndexedDb(): boolean {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Loads every entry from IndexedDB. Returns [] on the server or if the
 * store is empty/unavailable — never throws to the caller. */
export async function loadEntries(): Promise<LogbookEntry[]> {
  if (!hasIndexedDb()) return [];
  try {
    const db = await openDb();
    return await new Promise<LogbookEntry[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result as LogbookEntry[]);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

/** Inserts or updates a single entry (keyed by id). */
export async function putEntry(entry: LogbookEntry): Promise<void> {
  if (!hasIndexedDb()) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteEntry(id: string): Promise<void> {
  if (!hasIndexedDb()) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Wipes every entry — used by "delete all" after the user confirms. */
export async function clearAllEntries(): Promise<void> {
  if (!hasIndexedDb()) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Replaces the entire store's contents with `entries` — used by import, so
 * a restored backup fully reflects the imported file. */
export async function replaceAllEntries(entries: LogbookEntry[]): Promise<void> {
  if (!hasIndexedDb()) return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    for (const entry of entries) store.put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
