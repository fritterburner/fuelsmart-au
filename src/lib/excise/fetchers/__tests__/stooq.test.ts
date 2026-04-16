import { parseStooqBrent } from "../stooq";

describe("parseStooqBrent", () => {
  it("extracts Close from a valid Stooq CSV", () => {
    const csv =
      "Symbol,Date,Time,Open,High,Low,Close,Volume\n" +
      "CB.F,2026-04-16,08:18:12,94.65,95.29,94.44,94.78,\n";
    expect(parseStooqBrent(csv)).toBe(94.78);
  });

  it("handles CRLF line endings", () => {
    const csv =
      "Symbol,Date,Time,Open,High,Low,Close,Volume\r\n" +
      "CB.F,2026-04-16,08:18:12,94.65,95.29,94.44,94.78,\r\n";
    expect(parseStooqBrent(csv)).toBe(94.78);
  });

  it("is case-insensitive on header", () => {
    const csv =
      "SYMBOL,DATE,TIME,OPEN,HIGH,LOW,CLOSE,VOLUME\n" +
      "CB.F,2026-04-16,08:18:12,94.65,95.29,94.44,88.50,\n";
    expect(parseStooqBrent(csv)).toBe(88.5);
  });

  it("throws when CSV has no data row", () => {
    expect(() => parseStooqBrent("Symbol,Date,Close\n")).toThrow("no data row");
    expect(() => parseStooqBrent("")).toThrow("no data row");
  });

  it("throws when Close column is missing from header", () => {
    const csv = "Symbol,Date,Time\nCB.F,2026-04-16,08:18:12\n";
    expect(() => parseStooqBrent(csv)).toThrow("no Close column");
  });

  it("throws when Close is N/D (Stooq's no-data marker)", () => {
    const csv = "Symbol,Date,Close\nCB.F,2026-04-16,N/D\n";
    expect(() => parseStooqBrent(csv)).toThrow("empty or N/D");
  });

  it("throws when Close is not numeric", () => {
    const csv = "Symbol,Date,Close\nCB.F,2026-04-16,banana\n";
    expect(() => parseStooqBrent(csv)).toThrow("not a number");
  });

  it("throws when Close is out of range", () => {
    const csv1 = "Symbol,Date,Close\nCB.F,2026-04-16,0.5\n";
    const csv2 = "Symbol,Date,Close\nCB.F,2026-04-16,999\n";
    expect(() => parseStooqBrent(csv1)).toThrow("out of range");
    expect(() => parseStooqBrent(csv2)).toThrow("out of range");
  });
});
