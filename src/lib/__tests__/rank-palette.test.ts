import { assignRankColors, RANK_COLORS } from "../rank-palette";

const { green, orange, red, gray } = RANK_COLORS;

describe("assignRankColors", () => {
  it("returns [] for empty input", () => {
    expect(assignRankColors([], 3)).toEqual([]);
  });

  it("all green when N >= total", () => {
    expect(assignRankColors([100, 110, 120], 5)).toEqual([green, green, green]);
    expect(assignRankColors([100, 110, 120], 3)).toEqual([green, green, green]);
  });

  describe("small sets (total < 10) — green + gray only", () => {
    it("marks top N cheapest green, rest gray", () => {
      const prices = [100, 110, 120, 130, 140];
      expect(assignRankColors(prices, 2)).toEqual([green, green, gray, gray, gray]);
    });

    it("handles unsorted input", () => {
      const prices = [140, 100, 130, 110, 120];
      expect(assignRankColors(prices, 2)).toEqual([gray, green, gray, green, gray]);
    });

    it("ties at the green boundary: all tied stations go green", () => {
      // Two stations tied at the cheapest price, N=1 → both still green.
      const prices = [100, 100, 110, 120];
      expect(assignRankColors(prices, 1)).toEqual([green, green, gray, gray]);
    });
  });

  describe("larger sets (total >= 10) — green + orange + red + gray", () => {
    it("20 stations, N=3: top 3 green, bottom 2 red, next 4 orange, 11 gray", () => {
      // Prices 100..119 (20 unique).
      const prices = Array.from({ length: 20 }, (_, i) => 100 + i);
      const colors = assignRankColors(prices, 3);
      // sorted index 0..2 → green
      expect(colors.slice(0, 3)).toEqual([green, green, green]);
      // sorted index 3..13 → gray (11)
      for (let i = 3; i <= 13; i++) expect(colors[i]).toBe(gray);
      // sorted index 14..17 → orange (4 = 20%)
      for (let i = 14; i <= 17; i++) expect(colors[i]).toBe(orange);
      // sorted index 18..19 → red (2 = 10%)
      expect(colors[18]).toBe(red);
      expect(colors[19]).toBe(red);
    });

    it("10 stations, N=3: 3 green, 1 red, 2 orange, 4 gray", () => {
      const prices = Array.from({ length: 10 }, (_, i) => 100 + i);
      const colors = assignRankColors(prices, 3);
      expect(colors.slice(0, 3)).toEqual([green, green, green]);
      for (let i = 3; i <= 6; i++) expect(colors[i]).toBe(gray);
      expect(colors[7]).toBe(orange);
      expect(colors[8]).toBe(orange);
      expect(colors[9]).toBe(red);
    });

    it("red ties: if the bottom-10% price is tied with one above, both go red", () => {
      // 10 stations, floor(10%) = 1 red. But if the top 2 are tied, both red by price.
      const prices = [100, 101, 102, 103, 104, 105, 106, 107, 120, 120];
      const colors = assignRankColors(prices, 3);
      expect(colors[8]).toBe(red);
      expect(colors[9]).toBe(red);
    });

    it("green takes precedence when tier boundaries collide (large N)", () => {
      // N = 15 on total=20: green dominates; only top 2 should remain red.
      const prices = Array.from({ length: 20 }, (_, i) => 100 + i);
      const colors = assignRankColors(prices, 15);
      // sorted 0..14 green (N=15)
      for (let i = 0; i < 15; i++) expect(colors[i]).toBe(green);
      // orange band collapses (overlaps with green); reds still emerge
      expect(colors[18]).toBe(red);
      expect(colors[19]).toBe(red);
    });

    it("ignores input order — assignment is by price, not array index", () => {
      const shuffled = [119, 100, 115, 101, 118, 102, 117, 103, 116, 104,
                        105, 106, 107, 108, 109, 110, 111, 112, 113, 114];
      const colors = assignRankColors(shuffled, 3);
      // Map price -> expected colour by referring to sorted ranks.
      const sorted = [...shuffled].sort((a, b) => a - b);
      shuffled.forEach((p, i) => {
        const rank = sorted.indexOf(p);
        if (rank < 3) expect(colors[i]).toBe(green);
        else if (rank >= 18) expect(colors[i]).toBe(red);
        else if (rank >= 14) expect(colors[i]).toBe(orange);
        else expect(colors[i]).toBe(gray);
      });
    });
  });

  it("clamps highlightCount to 1 when <= 0", () => {
    const prices = [100, 110, 120, 130];
    // highlightCount 0 → treated as 1: only cheapest goes green.
    expect(assignRankColors(prices, 0)).toEqual([green, gray, gray, gray]);
  });
});
