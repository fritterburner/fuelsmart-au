import {
  LogbookEntry,
  normalizeEntryDraft,
  computeConsumptionGaps,
  computeMonthlyTotals,
  computeSummary,
  parseImportedLogbook,
  isValidDateString,
  sortEntriesNewestFirst,
} from "../logbook";

function mkEntry(overrides: Partial<LogbookEntry> = {}): LogbookEntry {
  return {
    id: "e1",
    date: "2026-01-15",
    odometerKm: null,
    litres: 40,
    totalCost: 88,
    pricePerLitre: 220,
    fuel: "U91",
    station: "",
    notes: "",
    ...overrides,
  };
}

describe("isValidDateString", () => {
  test("accepts a real calendar date", () => {
    expect(isValidDateString("2026-07-15")).toBe(true);
  });
  test("rejects an impossible date", () => {
    expect(isValidDateString("2026-02-30")).toBe(false);
  });
  test("rejects malformed strings", () => {
    expect(isValidDateString("15/07/2026")).toBe(false);
    expect(isValidDateString("")).toBe(false);
    expect(isValidDateString(undefined)).toBe(false);
  });
});

describe("normalizeEntryDraft — c/L derivation", () => {
  test("derives price per litre from total cost", () => {
    const result = normalizeEntryDraft({
      date: "2026-01-10",
      litres: 40,
      totalCost: 88,
      fuel: "U91",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.entry.pricePerLitre).toBeCloseTo(220, 5);
      expect(result.entry.totalCost).toBeCloseTo(88, 5);
    }
  });

  test("derives total cost from price per litre", () => {
    const result = normalizeEntryDraft({
      date: "2026-01-10",
      litres: 40,
      pricePerLitre: 220,
      fuel: "U91",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.entry.totalCost).toBeCloseTo(88, 5);
      expect(result.entry.pricePerLitre).toBeCloseTo(220, 5);
    }
  });

  test("price per litre is rounded to 1 decimal", () => {
    // 55.55 / 32.7 * 100 = 169.87768... -> 169.9
    const result = normalizeEntryDraft({
      date: "2026-01-10",
      litres: 32.7,
      totalCost: 55.55,
      fuel: "DL",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.entry.pricePerLitre).toBeCloseTo(169.9, 5);
    }
  });

  test("keeps both values when both are supplied, without re-deriving", () => {
    const result = normalizeEntryDraft({
      date: "2026-01-10",
      litres: 40,
      totalCost: 88.5,
      pricePerLitre: 219,
      fuel: "U91",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.entry.totalCost).toBeCloseTo(88.5, 5);
      expect(result.entry.pricePerLitre).toBeCloseTo(219, 5);
    }
  });

  test("rejects when neither cost nor price is given", () => {
    const result = normalizeEntryDraft({
      date: "2026-01-10",
      litres: 40,
      fuel: "U91",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(" ")).toMatch(/total cost or a price per litre/i);
    }
  });

  test("rejects non-positive litres", () => {
    const result = normalizeEntryDraft({
      date: "2026-01-10",
      litres: 0,
      totalCost: 50,
      fuel: "U91",
    });
    expect(result.ok).toBe(false);
  });

  test("rejects invalid date", () => {
    const result = normalizeEntryDraft({
      date: "not-a-date",
      litres: 40,
      totalCost: 88,
      fuel: "U91",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(" ")).toMatch(/valid date/i);
    }
  });

  test("rejects unknown fuel code", () => {
    const result = normalizeEntryDraft({
      date: "2026-01-10",
      litres: 40,
      totalCost: 88,
      // @ts-expect-error deliberately invalid for the test
      fuel: "ROCKET_FUEL",
    });
    expect(result.ok).toBe(false);
  });

  test("rejects negative odometer but allows null/omitted", () => {
    const bad = normalizeEntryDraft({
      date: "2026-01-10",
      litres: 40,
      totalCost: 88,
      fuel: "U91",
      odometerKm: -5,
    });
    expect(bad.ok).toBe(false);

    const okOmitted = normalizeEntryDraft({
      date: "2026-01-10",
      litres: 40,
      totalCost: 88,
      fuel: "U91",
    });
    expect(okOmitted.ok).toBe(true);
    if (okOmitted.ok) expect(okOmitted.entry.odometerKm).toBeNull();
  });
});

describe("computeConsumptionGaps", () => {
  test("computes L/100km and $/100km between two odometer readings", () => {
    const entries = [
      mkEntry({ id: "a", date: "2026-01-01", odometerKm: 10000, litres: 40, totalCost: 88 }),
      mkEntry({ id: "b", date: "2026-01-15", odometerKm: 10500, litres: 45, totalCost: 99 }),
    ];
    const gaps = computeConsumptionGaps(entries);
    expect(gaps).toHaveLength(1);
    // 45L / 500km * 100 = 9 L/100km
    expect(gaps[0].lPer100Km).toBeCloseTo(9, 5);
    // $99 / 500km * 100 = $19.80/100km
    expect(gaps[0].costPer100Km).toBeCloseTo(19.8, 5);
    expect(gaps[0].kmDriven).toBeCloseTo(500, 5);
  });

  test("handles out-of-order dates by sorting before pairing", () => {
    const entries = [
      mkEntry({ id: "b", date: "2026-01-15", odometerKm: 10500, litres: 45, totalCost: 99 }),
      mkEntry({ id: "a", date: "2026-01-01", odometerKm: 10000, litres: 40, totalCost: 88 }),
      mkEntry({ id: "c", date: "2026-01-30", odometerKm: 11000, litres: 42, totalCost: 92.4 }),
    ];
    const gaps = computeConsumptionGaps(entries);
    expect(gaps).toHaveLength(2);
    expect(gaps[0].fromId).toBe("a");
    expect(gaps[0].toId).toBe("b");
    expect(gaps[1].fromId).toBe("b");
    expect(gaps[1].toId).toBe("c");
  });

  test("skips gaps where an odometer reading is missing, never producing NaN", () => {
    const entries = [
      mkEntry({ id: "a", date: "2026-01-01", odometerKm: 10000, litres: 40, totalCost: 88 }),
      mkEntry({ id: "b", date: "2026-01-10", odometerKm: null, litres: 20, totalCost: 44 }),
      mkEntry({ id: "c", date: "2026-01-20", odometerKm: 10600, litres: 45, totalCost: 99 }),
    ];
    const gaps = computeConsumptionGaps(entries);
    // Only a->c forms a gap; b is excluded from the odometer chain entirely.
    expect(gaps).toHaveLength(1);
    expect(gaps[0].fromId).toBe("a");
    expect(gaps[0].toId).toBe("c");
    expect(Number.isNaN(gaps[0].lPer100Km)).toBe(false);
    expect(Number.isNaN(gaps[0].costPer100Km)).toBe(false);
  });

  test("returns no gaps when fewer than two odometer readings exist", () => {
    const entries = [
      mkEntry({ id: "a", date: "2026-01-01", odometerKm: null }),
      mkEntry({ id: "b", date: "2026-01-10", odometerKm: 10500 }),
    ];
    expect(computeConsumptionGaps(entries)).toEqual([]);
  });

  test("skips a pair with equal or decreasing odometer (bad/duplicate data)", () => {
    const entries = [
      mkEntry({ id: "a", date: "2026-01-01", odometerKm: 10000, litres: 40, totalCost: 88 }),
      mkEntry({ id: "b", date: "2026-01-05", odometerKm: 10000, litres: 10, totalCost: 22 }),
      mkEntry({ id: "c", date: "2026-01-10", odometerKm: 9990, litres: 10, totalCost: 22 }),
    ];
    const gaps = computeConsumptionGaps(entries);
    expect(gaps).toEqual([]);
  });
});

describe("computeMonthlyTotals", () => {
  test("aggregates spend/litres per calendar month", () => {
    const entries = [
      mkEntry({ id: "a", date: "2026-01-05", litres: 40, totalCost: 88 }),
      mkEntry({ id: "b", date: "2026-01-20", litres: 30, totalCost: 69 }),
      mkEntry({ id: "c", date: "2026-02-02", litres: 50, totalCost: 110 }),
    ];
    const totals = computeMonthlyTotals(entries);
    expect(totals).toHaveLength(2);
    expect(totals[0].month).toBe("2026-01");
    expect(totals[0].totalCost).toBeCloseTo(157, 5);
    expect(totals[0].totalLitres).toBeCloseTo(70, 5);
    expect(totals[0].fillCount).toBe(2);
    expect(totals[1].month).toBe("2026-02");
    expect(totals[1].totalCost).toBeCloseTo(110, 5);
  });

  test("sorts correctly across a year boundary", () => {
    const entries = [
      mkEntry({ id: "a", date: "2026-01-10", litres: 40, totalCost: 88 }),
      mkEntry({ id: "b", date: "2025-12-20", litres: 30, totalCost: 66 }),
      mkEntry({ id: "c", date: "2025-11-05", litres: 35, totalCost: 77 }),
    ];
    const totals = computeMonthlyTotals(entries);
    expect(totals.map((t) => t.month)).toEqual(["2025-11", "2025-12", "2026-01"]);
  });

  test("empty input yields empty output", () => {
    expect(computeMonthlyTotals([])).toEqual([]);
  });
});

describe("computeSummary", () => {
  test("returns null averages (not NaN) when there are no consumption gaps", () => {
    const entries = [mkEntry({ id: "a", odometerKm: null })];
    const summary = computeSummary(entries);
    expect(summary.avgLPer100Km).toBeNull();
    expect(summary.avgCostPer100Km).toBeNull();
    expect(summary.totalKmTracked).toBe(0);
    expect(summary.avgPricePerLitre).toBeGreaterThan(0);
  });

  test("computes weighted averages across multiple gaps", () => {
    const entries = [
      mkEntry({ id: "a", date: "2026-01-01", odometerKm: 10000, litres: 40, totalCost: 80 }),
      mkEntry({ id: "b", date: "2026-01-15", odometerKm: 10500, litres: 45, totalCost: 99 }),
      mkEntry({ id: "c", date: "2026-01-30", odometerKm: 11000, litres: 40, totalCost: 88 }),
    ];
    const summary = computeSummary(entries);
    // two gaps: 500km/45L, 500km/40L -> total 1000km, 85L
    expect(summary.totalKmTracked).toBeCloseTo(1000, 5);
    expect(summary.avgLPer100Km).toBeCloseTo(8.5, 5);
  });
});

describe("sortEntriesNewestFirst", () => {
  test("orders by date descending", () => {
    const entries = [
      mkEntry({ id: "old", date: "2026-01-01" }),
      mkEntry({ id: "new", date: "2026-02-01" }),
      mkEntry({ id: "mid", date: "2026-01-15" }),
    ];
    const sorted = sortEntriesNewestFirst(entries);
    expect(sorted.map((e) => e.id)).toEqual(["new", "mid", "old"]);
  });
});

describe("parseImportedLogbook", () => {
  const validEntry = {
    id: "e1",
    date: "2026-01-15",
    odometerKm: 10000,
    litres: 40,
    totalCost: 88,
    pricePerLitre: 220,
    fuel: "U91",
    station: "Shell Darwin",
    notes: "",
  };

  test("accepts a wrapped export file", () => {
    const result = parseImportedLogbook({
      version: 1,
      exportedAt: "2026-01-15T00:00:00.000Z",
      entries: [validEntry],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].id).toBe("e1");
    }
  });

  test("accepts a bare array of entries", () => {
    const result = parseImportedLogbook([validEntry]);
    expect(result.ok).toBe(true);
  });

  test("rejects non-JSON-object input", () => {
    expect(parseImportedLogbook(null).ok).toBe(false);
    expect(parseImportedLogbook("just a string").ok).toBe(false);
    expect(parseImportedLogbook(42).ok).toBe(false);
  });

  test("rejects an object with no entries array", () => {
    const result = parseImportedLogbook({ version: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/entries/i);
  });

  test("rejects an entry with an invalid date", () => {
    const result = parseImportedLogbook([{ ...validEntry, date: "15-01-2026" }]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/date/i);
  });

  test("rejects an entry with negative litres", () => {
    const result = parseImportedLogbook([{ ...validEntry, litres: -5 }]);
    expect(result.ok).toBe(false);
  });

  test("rejects an entry with an unknown fuel code", () => {
    const result = parseImportedLogbook([{ ...validEntry, fuel: "MAGIC" }]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/fuel/i);
  });

  test("rejects an entry missing required fields", () => {
    const { id, ...withoutId } = validEntry;
    void id;
    const result = parseImportedLogbook([withoutId]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/id/i);
  });

  test("rejects duplicate ids", () => {
    const result = parseImportedLogbook([validEntry, { ...validEntry }]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/duplicate/i);
  });
});
