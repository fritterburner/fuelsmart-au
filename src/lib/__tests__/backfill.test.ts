import {
  parseCsvLine,
  detectColumns,
  normaliseFuel,
  normalisePrice,
  toDayKey,
  aggregateRows,
  finaliseDay,
} from "../backfill";

describe("parseCsvLine", () => {
  it("splits simple rows", () => {
    expect(parseCsvLine("a,b,c")).toEqual(["a", "b", "c"]);
  });
  it("respects commas inside quotes", () => {
    expect(parseCsvLine('"123 Smith St, Unit 2",NSW,189.9')).toEqual([
      "123 Smith St, Unit 2",
      "NSW",
      "189.9",
    ]);
  });
  it("handles escaped double-quotes", () => {
    expect(parseCsvLine('"a ""b"" c",d')).toEqual(['a "b" c', "d"]);
  });
});

describe("detectColumns", () => {
  it("finds columns in an NSW-style header", () => {
    const cols = detectColumns(["ServiceStationName", "Address", "Suburb", "Postcode", "Brand", "FuelCode", "PriceUpdatedDate", "Price"]);
    expect(cols).toEqual({ fuel: 5, price: 7, date: 6 });
  });
  it("finds columns in a QLD-style header", () => {
    const cols = detectColumns(["SiteId", "Site_Name", "Site_Brand", "Site_Suburb", "Fuel_Type", "Price", "TransactionDateUtc"]);
    expect(cols).toEqual({ fuel: 4, price: 5, date: 6 });
  });
  it("errors and lists headers when a column is missing", () => {
    const res = detectColumns(["name", "suburb", "amount"]);
    expect(res).toHaveProperty("error");
  });
});

describe("normaliseFuel", () => {
  it("maps NSW codes and QLD names alike", () => {
    expect(normaliseFuel("U91")).toBe("U91");
    expect(normaliseFuel("Unleaded 91")).toBe("U91");
    expect(normaliseFuel("Diesel")).toBe("DL");
    expect(normaliseFuel("PULP 98")).toBe("P98");
    expect(normaliseFuel("E10")).toBe("E10");
  });
  it("returns null for unknown fuels", () => {
    expect(normaliseFuel("Hydrogen")).toBeNull();
  });
});

describe("normalisePrice", () => {
  it("accepts plain cents", () => {
    expect(normalisePrice("189.9")).toBeCloseTo(189.9, 5);
  });
  it("converts tenths-of-a-cent", () => {
    expect(normalisePrice("1899")).toBeCloseTo(189.9, 5);
  });
  it("rejects sentinels and junk", () => {
    expect(normalisePrice("9999")).toBeNull(); // 999.9 after /10 -> out of range
    expect(normalisePrice("0")).toBeNull();
    expect(normalisePrice("abc")).toBeNull();
  });
});

describe("toDayKey", () => {
  it("parses ISO datetimes", () => {
    expect(toDayKey("2025-06-15 13:45:00")).toBe("2025-06-15");
  });
  it("parses Australian DD/MM/YYYY", () => {
    expect(toDayKey("15/06/2025 13:45")).toBe("2025-06-15");
  });
  it("returns null for garbage", () => {
    expect(toDayKey("not a date")).toBeNull();
  });
});

describe("aggregateRows + finaliseDay", () => {
  it("aggregates per-day, per-fuel avg/min/count", () => {
    const cols = { fuel: 0, price: 1, date: 2 };
    const rows = [
      ["U91", "200.0", "2025-06-01 08:00"],
      ["U91", "190.0", "2025-06-01 16:00"],
      ["DL", "210.0", "2025-06-01 09:00"],
      ["U91", "180.0", "2025-06-02 08:00"],
    ];
    const agg = aggregateRows(rows, cols);

    const d1 = finaliseDay(agg.get("2025-06-01")!);
    expect(d1.U91).toEqual({ avg: 195, min: 190, count: 2 });
    expect(d1.DL).toEqual({ avg: 210, min: 210, count: 1 });

    const d2 = finaliseDay(agg.get("2025-06-02")!);
    expect(d2.U91).toEqual({ avg: 180, min: 180, count: 1 });
  });

  it("skips rows with unknown fuel or bad price/date", () => {
    const cols = { fuel: 0, price: 1, date: 2 };
    const rows = [
      ["Hydrogen", "200.0", "2025-06-01"],
      ["U91", "9999", "2025-06-01"],
      ["U91", "190.0", "garbage"],
      ["U91", "188.0", "2025-06-01"],
    ];
    const agg = aggregateRows(rows, cols);
    const d1 = finaliseDay(agg.get("2025-06-01")!);
    expect(d1.U91).toEqual({ avg: 188, min: 188, count: 1 });
  });
});
