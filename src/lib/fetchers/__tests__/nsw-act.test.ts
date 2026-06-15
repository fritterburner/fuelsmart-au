import { isActPostcode } from "../nsw";

describe("isActPostcode — ACT vs NSW classification safety net", () => {
  it("treats core Canberra postcodes as ACT", () => {
    expect(isActPostcode("2600")).toBe(true); // Parliamentary
    expect(isActPostcode("2601")).toBe(true); // City/Acton
    expect(isActPostcode("2617")).toBe(true); // Belconnen
    expect(isActPostcode("2906")).toBe(true); // Tuggeranong
    expect(isActPostcode("0200")).toBe(true); // ANU
  });

  it("does NOT claim shared/NSW border postcodes", () => {
    expect(isActPostcode("2620")).toBe(false); // Queanbeyan — shared, deliberately excluded
    expect(isActPostcode("2640")).toBe(false); // Albury NSW
    expect(isActPostcode("2000")).toBe(false); // Sydney
  });

  it("rejects junk input", () => {
    expect(isActPostcode("")).toBe(false);
    expect(isActPostcode("abcd")).toBe(false);
  });
});
